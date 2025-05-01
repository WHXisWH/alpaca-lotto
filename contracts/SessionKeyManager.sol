// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SessionKeyManager {
    using ECDSA for bytes32;

    struct SessionKeyData {
        address owner;
        uint256 validUntil;
        bytes targetEncoded;
        bytes functionEncoded;
    }

    mapping(address => SessionKeyData) public sessionKeys;

    event SessionKeyRegistered(address indexed owner, address indexed sessionKey, uint256 validUntil);
    event SessionKeyRevoked(address indexed owner, address indexed sessionKey);

    function registerSessionKey(
        address _sessionKey,
        uint256 _validUntil,
        address[] calldata _allowedTargets,
        bytes4[] calldata _allowedFunctions
    ) external {
        require(_sessionKey != address(0), "Invalid session key");
        require(_validUntil > block.timestamp, "Invalid expiration time");

        bytes memory targetEncoded = abi.encode(_allowedTargets);
        bytes memory functionEncoded = abi.encode(_allowedFunctions);

        sessionKeys[_sessionKey] = SessionKeyData({
            owner: msg.sender,
            validUntil: _validUntil,
            targetEncoded: targetEncoded,
            functionEncoded: functionEncoded
        });

        emit SessionKeyRegistered(msg.sender, _sessionKey, _validUntil);
    }

    function revokeSessionKey(address _sessionKey) external {
        require(sessionKeys[_sessionKey].owner == msg.sender, "Not your session key");

        delete sessionKeys[_sessionKey];

        emit SessionKeyRevoked(msg.sender, _sessionKey);
    }

    function validateSessionKey(
        address _sessionKey,
        address _target,
        bytes4 _selector
    ) external view returns (bool) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];

        if (keyData.owner == address(0) || keyData.validUntil <= block.timestamp) {
            return false;
        }

        address[] memory allowedTargets = abi.decode(keyData.targetEncoded, (address[]));
        bool targetAllowed = false;
        for (uint256 i = 0; i < allowedTargets.length; i++) {
            if (allowedTargets[i] == _target) {
                targetAllowed = true;
                break;
            }
        }
        if (!targetAllowed) return false;

        bytes4[] memory allowedFunctions = abi.decode(keyData.functionEncoded, (bytes4[]));
        bool functionAllowed = false;
        for (uint256 i = 0; i < allowedFunctions.length; i++) {
            if (allowedFunctions[i] == _selector) {
                functionAllowed = true;
                break;
            }
        }

        return functionAllowed;
    }

    function getAllowedTargets(address _sessionKey) external view returns (address[] memory) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        require(keyData.owner != address(0), "Session key not registered");

        return abi.decode(keyData.targetEncoded, (address[]));
    }

    function getAllowedFunctions(address _sessionKey) external view returns (bytes4[] memory) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        require(keyData.owner != address(0), "Session key not registered");

        return abi.decode(keyData.functionEncoded, (bytes4[]));
    }

    function isSessionKeyActive(address _sessionKey) external view returns (bool) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        return keyData.owner != address(0) && keyData.validUntil > block.timestamp;
    }

    function getSessionKeyData(address _sessionKey) external view returns (
        address owner,
        uint256 validUntil
    ) {
        SessionKeyData storage keyData = sessionKeys[_sessionKey];
        return (keyData.owner, keyData.validUntil);
    }
}
