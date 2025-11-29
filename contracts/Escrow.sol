// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "REENTRANCY");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    struct Deal {
        address payer;
        address payee;
        uint256 amount;
        bool funded;
        bool released;
        bool refunded;
    }

    mapping(uint256 => Deal) public deals;
    uint256 public nextId;

    event EscrowCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount);
    event Released(uint256 indexed id, address indexed to, uint256 amount);
    event Refunded(uint256 indexed id, address indexed to, uint256 amount);

    error InvalidAmount();
    error NotPayer();
    error NotFunded();
    error AlreadyCompleted();

    function createEscrow(address payee) external payable returns (uint256 id) {
        if (msg.value == 0) revert InvalidAmount();
        id = nextId++;
        deals[id] = Deal({
            payer: msg.sender,
            payee: payee,
            amount: msg.value,
            funded: true,
            released: false,
            refunded: false
        });
        emit EscrowCreated(id, msg.sender, payee, msg.value);
    }

    function release(uint256 id) external nonReentrant {
        Deal storage d = deals[id];
        if (msg.sender != d.payer) revert NotPayer();
        if (!d.funded) revert NotFunded();
        if (d.released || d.refunded) revert AlreadyCompleted();

        d.released = true;
        uint256 amount = d.amount;
        d.amount = 0;
        (bool ok, ) = d.payee.call{value: amount}("");
        require(ok, "TRANSFER_FAIL");
        emit Released(id, d.payee, amount);
    }

    function refund(uint256 id) external nonReentrant {
        Deal storage d = deals[id];
        if (msg.sender != d.payer) revert NotPayer();
        if (!d.funded) revert NotFunded();
        if (d.released || d.refunded) revert AlreadyCompleted();

        d.refunded = true;
        uint256 amount = d.amount;
        d.amount = 0;
        (bool ok, ) = d.payer.call{value: amount}("");
        require(ok, "TRANSFER_FAIL");
        emit Refunded(id, d.payer, amount);
    }

    function getDeal(uint256 id)
        external
        view
        returns (address payer, address payee, uint256 amount, bool funded, bool released, bool refunded)
    {
        Deal storage d = deals[id];
        return (d.payer, d.payee, d.amount, d.funded, d.released, d.refunded);
    }
}
