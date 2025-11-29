// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NamingRegistry {
    mapping(address => string) private _names;

    event NameSet(address indexed user, string name);

    function setName(string calldata name) external {
        _names[msg.sender] = name;
        emit NameSet(msg.sender, name);
    }

    function getName(address user) external view returns (string memory) {
        return _names[user];
    }

    function myName() external view returns (string memory) {
        return _names[msg.sender];
    }
}
