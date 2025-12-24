// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ITokenSale {
    function purchaseWithEscrow(
        address investor,
        uint256 paymentAmount,
        address paymentToken
    ) external payable returns (uint256 tokenAmount);
}

/**
 * @title InvestmentEscrow
 * @notice Individual escrow contract for holding investor funds pending KYC approval
 * @dev Ensures AML compliance by keeping TokenSale out of deposit transaction chain
 */
contract InvestmentEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Escrow states
    enum Status {
        Active,
        Approved,
        PartiallyApproved,
        Rejected,
        Executed,
        Refunded,
        Expired
    }

    // Constants
    uint256 public constant MAX_ESCROW_DURATION = 30 days;
    uint256 public constant ADMIN_ACTION_DEADLINE = 14 days;

    // Immutable state
    address public immutable factory;
    address public immutable investor;
    address public immutable tokenSale;
    address public immutable paymentToken;
    uint256 public immutable createdAt;
    uint256 public immutable expirationTime;
    uint256 public immutable adminDeadline;

    // Mutable state
    uint256 public amount;
    uint256 public tokenAmount;
    Status public status;
    string public rejectionReason;
    uint256 public approvedAmount;
    uint256 public refundedAmount;

    // Events
    event Deposited(uint256 amount);
    event Approved(uint256 amount, address indexed admin);
    event PartiallyApproved(uint256 approvedAmount, uint256 refundedAmount, address indexed admin);
    event Rejected(string reason, address indexed admin);
    event Refunded(uint256 amount);
    event TokensPurchased(uint256 tokenAmount);
    event EmergencyWithdrawal(address to, uint256 amount, address indexed admin);

    // Modifiers
    modifier onlyAdmin() {
        require(IEscrowFactory(factory).isAdmin(msg.sender), "Only admin");
        _;
    }

    modifier onlyInvestor() {
        require(msg.sender == investor, "Only investor");
        _;
    }

    modifier inStatus(Status _status) {
        require(status == _status, "Invalid status");
        _;
    }

    /**
     * @notice Initialize escrow contract
     * @param _investor The investor address
     * @param _tokenSale The TokenSale contract address
     * @param _paymentToken The payment token address (0x0 for ETH)
     */
    constructor(
        address _investor,
        address _tokenSale,
        address _paymentToken
    ) {
        require(_investor != address(0), "Invalid investor");
        require(_tokenSale != address(0), "Invalid token sale");
        
        factory = msg.sender;
        investor = _investor;
        tokenSale = _tokenSale;
        paymentToken = _paymentToken;
        
        createdAt = block.timestamp;
        expirationTime = block.timestamp + MAX_ESCROW_DURATION;
        adminDeadline = block.timestamp + ADMIN_ACTION_DEADLINE;
        
        status = Status.Active;
    }

    /**
     * @notice Deposit funds into escrow (separate transaction from creation)
     * @dev Only the designated investor can deposit to prevent AML/flow confusion
     * @param _amount Amount to deposit (ignored for ETH)
     */
    function deposit(uint256 _amount) external payable nonReentrant {
        require(msg.sender == investor, "Only investor can deposit");
        require(status == Status.Active, "Escrow not active");
        require(amount == 0, "Already funded");
        require(block.timestamp < expirationTime, "Escrow expired");

        if (paymentToken == address(0)) {
            // ETH payment
            require(msg.value > 0, "No ETH sent");
            amount = msg.value;
        } else {
            // ERC20 payment
            require(_amount > 0, "Invalid amount");
            require(msg.value == 0, "ETH sent for token payment");
            
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), _amount);
            amount = _amount;
        }

        emit Deposited(amount);
    }

    /**
     * @notice Admin approves and executes investment
     */
    function approveAndExecute() external onlyAdmin nonReentrant {
        require(status == Status.Active && amount > 0, "Cannot approve");
        require(block.timestamp < expirationTime, "Escrow expired");

        status = Status.Approved;
        approvedAmount = amount;
        emit Approved(amount, msg.sender);

        _executePurchase(amount);
    }

    /**
     * @notice Admin partially approves investment
     * @param _approvedAmount Amount to approve for investment
     */
    function partialApproveAndExecute(uint256 _approvedAmount) external onlyAdmin nonReentrant {
        require(status == Status.Active && amount > 0, "Cannot approve");
        require(_approvedAmount > 0 && _approvedAmount < amount, "Invalid approved amount");
        require(block.timestamp < expirationTime, "Escrow expired");

        status = Status.PartiallyApproved;
        approvedAmount = _approvedAmount;
        refundedAmount = amount - _approvedAmount;
        
        emit PartiallyApproved(approvedAmount, refundedAmount, msg.sender);

        // Execute purchase with approved amount
        _executePurchase(approvedAmount);

        // Refund the difference
        _refund(investor, refundedAmount);
    }

    /**
     * @notice Admin rejects investment and refunds
     * @param _reason Rejection reason
     */
    function rejectAndRefund(string memory _reason) external onlyAdmin nonReentrant {
        require(status == Status.Active && amount > 0, "Cannot reject");
        
        status = Status.Rejected;
        rejectionReason = _reason;
        refundedAmount = amount;
        
        emit Rejected(_reason, msg.sender);
        
        _refund(investor, amount);
    }

    /**
     * @notice Investor can refund if conditions are met
     * @dev Sets status to Expired if escrow expired or admin missed deadline,
     *      sets to Refunded if rejected (funds return via different path)
     */
    function refund() external nonReentrant {
        require(canRefund(), "Cannot refund");

        uint256 refundAmount = amount;

        // Track reason for refund in final status
        // Expired: escrow time limit reached OR admin missed deadline
        // Refunded: rejected by admin (different audit trail)
        if (status == Status.Active) {
            // Active + refundable means either expired or admin deadline passed
            status = Status.Expired;
        } else if (status == Status.Rejected) {
            // Already rejected, mark as refunded
            status = Status.Refunded;
        } else {
            // Fallback (shouldn't reach due to canRefund checks)
            status = Status.Refunded;
        }

        refundedAmount = refundAmount;

        _refund(investor, refundAmount);
    }

    /**
     * @notice Check if refund is available
     * @return True if investor can claim refund
     */
    function canRefund() public view returns (bool) {
        // Already finalized - no refund possible
        if (status == Status.Refunded || status == Status.Executed || status == Status.Expired) {
            return false;
        }

        // Admin rejected - refund available
        if (status == Status.Rejected) {
            return true;
        }

        // Escrow time limit reached - refund available
        if (block.timestamp >= expirationTime) {
            return true;
        }

        // Admin missed action deadline - refund available
        if (status == Status.Active && amount > 0 && block.timestamp >= adminDeadline) {
            return true;
        }

        return false;
    }

    /**
     * @notice Emergency withdrawal by admin (only for critical situations)
     */
    function emergencyWithdraw() external onlyAdmin nonReentrant {
        require(
            status != Status.Refunded && status != Status.Executed,
            "Already finalized"
        );
        
        uint256 withdrawAmount = _getBalance();
        require(withdrawAmount > 0, "Nothing to withdraw");
        
        status = Status.Refunded;
        refundedAmount = withdrawAmount;
        
        emit EmergencyWithdrawal(investor, withdrawAmount, msg.sender);
        
        _refund(investor, withdrawAmount);
    }

    /**
     * @notice Execute token purchase
     */
    function _executePurchase(uint256 _amount) private {
        // Approve TokenSale to spend tokens
        // Note: Using forceApprove instead of deprecated safeApprove
        // forceApprove handles tokens that require approval to be 0 before setting new value
        if (paymentToken != address(0)) {
            IERC20(paymentToken).forceApprove(tokenSale, _amount);
        }

        // Execute purchase
        if (paymentToken == address(0)) {
            // ETH purchase
            tokenAmount = ITokenSale(tokenSale).purchaseWithEscrow{value: _amount}(
                investor,
                _amount,
                paymentToken
            );
        } else {
            // Token purchase
            tokenAmount = ITokenSale(tokenSale).purchaseWithEscrow(
                investor,
                _amount,
                paymentToken
            );
        }

        status = Status.Executed;
        emit TokensPurchased(tokenAmount);
    }

    /**
     * @notice Internal refund function
     */
    function _refund(address _to, uint256 _amount) private {
        require(_amount > 0, "Nothing to refund");

        if (paymentToken == address(0)) {
            // Refund ETH
            (bool success, ) = _to.call{value: _amount}("");
            require(success, "ETH refund failed");
        } else {
            // Refund tokens
            IERC20(paymentToken).safeTransfer(_to, _amount);
        }

        emit Refunded(_amount);
    }

    /**
     * @notice Get current balance
     */
    function _getBalance() private view returns (uint256) {
        if (paymentToken == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(paymentToken).balanceOf(address(this));
        }
    }

    /**
     * @notice Receive ETH for purchases
     */
    receive() external payable {
        require(paymentToken == address(0), "Not ETH escrow");
    }
}

interface IEscrowFactory {
    function isAdmin(address account) external view returns (bool);
}