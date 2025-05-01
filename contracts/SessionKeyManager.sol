// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SessionKeyManager
 * @dev Contract to manage session keys for Account Abstraction wallets
 * Enables temporary authorized access to specific functions
 */
contract SessionKeyManager {
    using ECDSA for bytes32;

    struct SessionKeyData {
        address owner;
        uint256 validUntil;
        bytes32 targetHash; // Hash of allowed target contracts
        bytes32 functionHash; // Hash of allowed function selectors
    }

    mapping(address => SessionKeyData) public sessionKeys;

    event SessionKeyRegistered(address indexed owner, address indexed sessionKey, uint256 validUntil);
    event SessionKeyRevoked(address indexed owner, address indexed sessionKey);

    /**
     * @dev Register a new session key
     * @param _sessionKey The session key address
     * @param _validUntil Expiration timestamp
     * @param _allowedTargets Array of allowed target contracts
     * @param _allowedFunctions Array of allowed function selectors
     */
    function registerSessionKey(
        address _sessionKey,
        uint256 _validUntil,
        address[] calldata _allowedTargets,
        bytes4[] calldata _allowedFunctions
    ) external {
        require(_sessionKey != address(0), "Invalid session key");
        require(_validUntil > block.timestamp, "Invalid expiration time");
        
        // Calculate hashes of allowed targets and functions
        bytes32 targetHash = keccak256(abi.encodePacked(_allowedTargets));
        bytes32 functionHash = keccak256(abi.encodePacked(_allowedFunctions));
        
        // Store session key data
        sessionKeys[_sessionKey] = SessionKeyData({
            owner: msg.sender,
            validUntil: _validUntil,
            targetHash: targetHash,
            functionHash: functionHash
        });
        
        emit SessionKeyRegistered(msg.sender, _sessionKey, _validUntil);
    }

    /**
     * @dev Revoke a session key
     * @param _sessionKey The session key to revoke
     */
    function revokeSessionKey(address _sessionKey) external {
        require(sessionKeys[_sessionKey].owner == msg.sender, "Not your session key");
        
        delete sessionKeys[_sessionKey];
        
        emit SessionKeyRevoked(msg.sender, _sessionKey);
    }

    /**
     * @dev Validate a session key for a specific operation
     * @param _sessionKey The session key to validate
     * @param _target Target contract of the operation
     * @param _selector Function selector of the operation
     * @return Boolean indicating if the session key is valid for the operation
     */
    function validateSessionKey(
        address _sessionKey,
        address _target,
        bytes4 _selector
    ) external view returns (bool) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        
        // Check if session key is registered and not expired
        if (keyData.owner == address(0) || keyData.validUntil <= block.timestamp) {
            return false;
        }
        
        // Check if target is allowed
        address[] memory allowedTargets = abi.decode(keyData.targetHash, (address[]));
        
        bool targetAllowed = false;
        for (uint256 i = 0; i < allowedTargets.length; i++) {
            if (allowedTargets[i] == _target) {
                targetAllowed = true;
                break;
            }
        }
        
        if (!targetAllowed) return false;
        
        // Check if function is allowed
        bytes4[] memory allowedFunctions = abi.decode(keyData.functionHash, (bytes4[]));
        
        bool functionAllowed = false;
        for (uint256 i = 0; i < allowedFunctions.length; i++) {
            if (allowedFunctions[i] == _selector) {
                functionAllowed = true;
                break;
            }
        }
        
        return functionAllowed;
    }

    /**
     * @dev Get allowed targets for a session key
     * @param _sessionKey Session key address
     * @return Array of allowed target contracts
     */
    function getAllowedTargets(address _sessionKey) external view returns (address[] memory) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        require(keyData.owner != address(0), "Session key not registered");
        
        return abi.decode(keyData.targetHash, (address[]));
    }

    /**
     * @dev Get allowed functions for a session key
     * @param _sessionKey Session key address
     * @return Array of allowed function selectors
     */
    function getAllowedFunctions(address _sessionKey) external view returns (bytes4[] memory) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        require(keyData.owner != address(0), "Session key not registered");
        
        return abi.decode(keyData.functionHash, (bytes4[]));
    }

    /**
     * @dev Check if a session key is valid
     * @param _sessionKey Session key address
     * @return Boolean indicating if the session key is valid and not expired
     */
    function isValidSessionKey(address _sessionKey) external view returns (bool) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        
        return keyData.owner != address(0) && keyData.validUntil > block.timestamp;
    }

    /**
     * @dev Get session key data
     * @param _sessionKey Session key address
     * @return owner Owner of the session key
     * @return validUntil Expiration timestamp
     */
    function getSessionKeyData(address _sessionKey) external view returns (
        address owner,
        uint256 validUntil
    ) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        return (keyData.owner, keyData.validUntil);
    }
}