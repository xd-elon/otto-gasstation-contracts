// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

using SafeERC20 for IERC20;

/**
 * @title OttoGasStation
 * @notice Multisender + sponsored transactions (EOA-friendly)
 * @dev Infra-only contract. No business logic or billing rules.
 */
contract OttoGasStation is ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error NotAuthorized();
    error InvalidArrayLength();
    error BatchTooLarge();
    error Paused();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event SponsorDeposit(address indexed sponsor, uint256 amount);
    event SponsorWithdraw(address indexed to, uint256 amount);

    event TokenSent(
        address indexed executor,
        address indexed token,
        address indexed from,
        address to,
        uint256 amount,
        bytes32 workspaceId // metadata only (off-chain)
    );

    event ExecutorUpdated(address indexed executor, bool allowed);
    event PausedSet(bool paused);
    event FeeUpdated(uint256 feeBps);

    /*//////////////////////////////////////////////////////////////
                              CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 public constant MAX_BATCH = 100;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /*//////////////////////////////////////////////////////////////
                              STORAGE
    //////////////////////////////////////////////////////////////*/
    address public owner;
    bool public paused;

    /// @notice relayers / executors
    mapping(address => bool) public executors;

    /// @notice optional infra fee (bps)
    uint256 public feeBps;

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyExecutor() {
        if (!executors[msg.sender]) revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address _owner) {
        owner = _owner;
    }

    /*//////////////////////////////////////////////////////////////
                         ADMIN CONFIGURATION
    //////////////////////////////////////////////////////////////*/
    function setExecutor(address executor, bool allowed)
        external
        onlyOwner
    {
        executors[executor] = allowed;
        emit ExecutorUpdated(executor, allowed);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Fee too high"); // max 5%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    /*//////////////////////////////////////////////////////////////
                           SPONSOR ETH FLOW
    //////////////////////////////////////////////////////////////*/
    receive() external payable {
        emit SponsorDeposit(msg.sender, msg.value);
    }

    function withdrawETH(address payable to, uint256 amount)
        external
        onlyOwner
    {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "ETH_TRANSFER_FAILED");
        emit SponsorWithdraw(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                         CORE GAS STATION LOGIC
    //////////////////////////////////////////////////////////////*/
    function multisendERC20(
        address token,
        address from,
        address[] calldata to,
        uint256[] calldata amounts,
        bytes32 workspaceId // metadata only
    )
        external
        onlyExecutor
        whenNotPaused
        nonReentrant
    {
        uint256 len = to.length;

        if (len != amounts.length) revert InvalidArrayLength();
        if (len > MAX_BATCH) revert BatchTooLarge();

        uint256 totalAmount;

        for (uint256 i = 0; i < len; i++) {
            totalAmount += amounts[i];

            IERC20(token).safeTransferFrom(
                from,
                to[i],
                amounts[i]
            );

            emit TokenSent(
                msg.sender,
                token,
                from,
                to[i],
                amounts[i],
                workspaceId
            );
        }

        /// optional infra fee
        if (feeBps > 0) {
            uint256 fee = (totalAmount * feeBps) / BPS_DENOMINATOR;
            if (fee > 0) {
                IERC20(token).safeTransferFrom(from, owner, fee);
            }
        }
    }
}
