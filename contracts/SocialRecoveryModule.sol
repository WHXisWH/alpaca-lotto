// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SocialRecoveryModule
 * @dev Contract to enable social recovery for AA wallets
 * Allows users to recover access to their wallet through trusted guardians
 */
contract SocialRecoveryModule {
    using ECDSA for bytes32;

    struct RecoveryConfig {
        address[] guardians;
        uint256 threshold;
        uint256 delayPeriod;
    }

    struct RecoveryRequest {
        address newOwner;
        uint256 recoveryStarts;
        uint256 guardianApprovals;
        mapping(address => bool) guardianApproved;
    }

    mapping(address => RecoveryConfig) public recoveryConfigs;
    mapping(address => RecoveryRequest) public recoveryRequests;

    event GuardianAdded(address indexed wallet, address indexed guardian);
    event GuardianRemoved(address indexed wallet, address indexed guardian);
    event RecoveryConfigured(address indexed wallet, uint256 threshold, uint256 delayPeriod);
    event RecoveryInitiated(address indexed wallet, address indexed newOwner);
    event RecoveryApproved(address indexed wallet, address indexed guardian);
    event RecoveryExecuted(address indexed wallet, address indexed newOwner);
    event RecoveryCanceled(address indexed wallet);

    /**
     * @dev Configure recovery for a wallet
     * @param _guardians Array of guardian addresses
     * @param _threshold Number of guardians required for recovery
     * @param _delayPeriod Time delay before recovery can be executed
     */
    function configureRecovery(
        address[] calldata _guardians,
        uint256 _threshold,
        uint256 _delayPeriod
    ) external {
        require(_guardians.length > 0, "Must have at least one guardian");
        require(_threshold > 0 && _threshold <= _guardians.length, "Invalid threshold");
        require(_delayPeriod >= 1 days, "Delay too short");
        
        // Store new recovery configuration
        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        config.guardians = _guardians;
        config.threshold = _threshold;
        config.delayPeriod = _delayPeriod;
        
        emit RecoveryConfigured(msg.sender, _threshold, _delayPeriod);
    }

    /**
     * @dev Add a guardian to a wallet's recovery config
     * @param _guardian Guardian address to add
     */
    function addGuardian(address _guardian) external {
        require(_guardian != address(0), "Invalid guardian address");
        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        
        // Check if guardian already exists
        for (uint256 i = 0; i < config.guardians.length; i++) {
            require(config.guardians[i] != _guardian, "Guardian already exists");
        }
        
        config.guardians.push(_guardian);
        
        emit GuardianAdded(msg.sender, _guardian);
    }

    /**
     * @dev Remove a guardian from a wallet's recovery config
     * @param _guardian Guardian address to remove
     */
    function removeGuardian(address _guardian) external {
        RecoveryConfig storage config = recoveryConfigs[msg.sender];
        
        // Find and remove guardian
        bool found = false;
        for (uint256 i = 0; i < config.guardians.length; i++) {
            if (config.guardians[i] == _guardian) {
                // Replace with the last element and pop
                config.guardians[i] = config.guardians[config.guardians.length - 1];
                config.guardians.pop();
                found = true;
                break;
            }
        }
        
        require(found, "Guardian not found");
        
        // Ensure threshold is still valid
        if (config.threshold > config.guardians.length) {
            config.threshold = config.guardians.length;
        }
        
        emit GuardianRemoved(msg.sender, _guardian);
    }

    /**
     * @dev Initiate a recovery process
     * @param _wallet Wallet address to recover
     * @param _newOwner New owner address
     */
    function initiateRecovery(address _wallet, address _newOwner) external {
        RecoveryConfig storage config = recoveryConfigs[_wallet];
        
        // Ensure caller is a guardian
        bool isGuardian = false;
        for (uint256 i = 0; i < config.guardians.length; i++) {
            if (config.guardians[i] == msg.sender) {
                isGuardian = true;
                break;
            }
        }
        require(isGuardian, "Only guardians can initiate recovery");
        
        // Initialize recovery request
        RecoveryRequest storage request = recoveryRequests[_wallet];
        request.newOwner = _newOwner;
        request.recoveryStarts = block.timestamp;
        request.guardianApprovals = 1;
        request.guardianApproved[msg.sender] = true;
        
        emit RecoveryInitiated(_wallet, _newOwner);
    }

    /**
     * @dev Approve a recovery process
     * @param _wallet Wallet address being recovered
     */
    function approveRecovery(address _wallet) external {
        RecoveryConfig storage config = recoveryConfigs[_wallet];
        RecoveryRequest storage request = recoveryRequests[_wallet];
        
        require(request.newOwner != address(0), "No recovery in progress");
        require(!request.guardianApproved[msg.sender], "Already approved");
        
        // Ensure caller is a guardian
        bool isGuardian = false;
        for (uint256 i = 0; i < config.guardians.length; i++) {
            if (config.guardians[i] == msg.sender) {
                isGuardian = true;
                break;
            }
        }
        require(isGuardian, "Only guardians can approve recovery");
        
        request.guardianApproved[msg.sender] = true;
        request.guardianApprovals++;
        
        emit RecoveryApproved(_wallet, msg.sender);
    }

    /**
     * @dev Execute a recovery process
     * @param _wallet Wallet address being recovered
     */
    function executeRecovery(address _wallet) external {
        RecoveryConfig storage config = recoveryConfigs[_wallet];
        RecoveryRequest storage request = recoveryRequests[_wallet];
        
        require(request.newOwner != address(0), "No recovery in progress");
        require(request.guardianApprovals >= config.threshold, "Insufficient approvals");
        require(
            block.timestamp >= request.recoveryStarts + config.delayPeriod,
            "Delay period not elapsed"
        );
        
        address newOwner = request.newOwner;
        
        // Reset recovery request
        delete recoveryRequests[_wallet];
        
        // Here we would call the wallet's transferOwnership function
        // For demonstration, we'll just emit an event
        emit RecoveryExecuted(_wallet, newOwner);
    }

    /**
     * @dev Cancel a recovery process
     * @param _wallet Wallet address being recovered
     */
    function cancelRecovery(address _wallet) external {
        // Only the wallet owner can cancel recovery
        require(msg.sender == _wallet, "Only wallet owner can cancel");
        
        delete recoveryRequests[_wallet];
        
        emit RecoveryCanceled(_wallet);
    }

    /**
     * @dev Check if a recovery is pending
     * @param _wallet Wallet address to check
     * @return Boolean indicating if recovery is pending
     */
    function isRecoveryPending(address _wallet) external view returns (bool) {
        RecoveryRequest storage request = recoveryRequests[_wallet];
        return request.newOwner != address(0);
    }

    /**
     * @dev Get recovery status
     * @param _wallet Wallet address to check
     * @return newOwner New owner address
     * @return approvals Number of guardian approvals
     * @return requiredApprovals Number of required approvals
     * @return timeRemaining Time remaining before recovery can be executed
     */
    function getRecoveryStatus(address _wallet) external view returns (
        address newOwner,
        uint256 approvals,
        uint256 requiredApprovals,
        uint256 timeRemaining
    ) {
        RecoveryConfig storage config = recoveryConfigs[_wallet];
        RecoveryRequest storage request = recoveryRequests[_wallet];
        
        newOwner = request.newOwner;
        approvals = request.guardianApprovals;
        requiredApprovals = config.threshold;
        
        uint256 executeTime = request.recoveryStarts + config.delayPeriod;
        timeRemaining = block.timestamp >= executeTime ? 0 : executeTime - block.timestamp;
    }

    /**
     * @dev Get wallet guardians
     * @param _wallet Wallet address
     * @return Array of guardian addresses
     */
    function getGuardians(address _wallet) external view returns (address[] memory) {
        return recoveryConfigs[_wallet].guardians;
    }

    /**
     * @dev Get wallet recovery configuration
     * @param _wallet Wallet address
     * @return guardianCount Number of guardians
     * @return threshold Number of required approvals
     * @return delayPeriod Delay period before recovery can be executed
     */
    function getRecoveryConfig(address _wallet) external view returns (
        uint256 guardianCount,
        uint256 threshold,
        uint256 delayPeriod
    ) {
        RecoveryConfig storage config = recoveryConfigs[_wallet];
        return (
            config.guardians.length,
            config.threshold,
            config.delayPeriod
        );
    }
}