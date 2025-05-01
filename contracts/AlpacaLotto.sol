// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AlpacaLotto is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct Lottery {
        uint256 id;
        string name;
        uint256 ticketPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 drawTime;
        address[] supportedTokens;
        uint256 totalTickets;
        uint256 prizePool;
        bool drawn;
        address[] winners;
        uint256[] winningTickets;
    }

    struct UserTicket {
        uint256 lotteryId;
        uint256 ticketNumber;
        address user;
        address paymentToken;
        uint256 amountPaid;
    }

    struct SessionKey {
        address user;
        address key;
        uint256 validUntil;
        bytes32 operationsHash;
    }

    mapping(uint256 => Lottery) public lotteries;
    mapping(uint256 => mapping(uint256 => UserTicket)) public tickets;
    mapping(address => SessionKey) public sessionKeys;
    mapping(address => mapping(uint256 => uint256[])) public userTickets;

    uint256 public lotteryCounter;
    address public priceOracle;

    event LotteryCreated(uint256 indexed lotteryId, string name, uint256 ticketPrice);
    event TicketPurchased(uint256 indexed lotteryId, address indexed user, uint256 ticketNumber, address paymentToken);
    event LotteryDrawn(uint256 indexed lotteryId, address[] winners);
    event SessionKeyCreated(address indexed user, address indexed key, uint256 validUntil);
    event SessionKeyRevoked(address indexed user, address indexed key);

    modifier onlyActiveLottery(uint256 _lotteryId) {
        require(
            lotteries[_lotteryId].startTime <= block.timestamp &&
            lotteries[_lotteryId].endTime > block.timestamp,
            "Lottery is not active"
        );
        _;
    }

    modifier onlyValidSessionKey(address _user) {
        if (msg.sender != _user) {
            SessionKey storage sessionKey = sessionKeys[msg.sender];
            require(sessionKey.user == _user, "Invalid session key");
            require(sessionKey.validUntil > block.timestamp, "Session key expired");
        }
        _;
    }

    constructor(address _priceOracle) {
        priceOracle = _priceOracle;
    }

    function createLottery(
        string memory _name,
        uint256 _ticketPrice,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _drawTime,
        address[] memory _supportedTokens
    ) external onlyOwner {
        require(_startTime >= block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_drawTime >= _endTime, "Draw time must be after end time");
        require(_supportedTokens.length > 0, "Must support at least one token");

        lotteryCounter++;

        Lottery storage lottery = lotteries[lotteryCounter];
        lottery.id = lotteryCounter;
        lottery.name = _name;
        lottery.ticketPrice = _ticketPrice;
        lottery.startTime = _startTime;
        lottery.endTime = _endTime;
        lottery.drawTime = _drawTime;
        lottery.supportedTokens = _supportedTokens;

        emit LotteryCreated(lotteryCounter, _name, _ticketPrice);
    }

    function purchaseTickets(
        uint256 _lotteryId,
        address _tokenAddress,
        uint256 _quantity
    ) external onlyActiveLottery(_lotteryId) nonReentrant {
        _purchaseTicketsFor(msg.sender, _lotteryId, _tokenAddress, _quantity);
    }

    function purchaseTicketsFor(
        address _user,
        uint256 _lotteryId,
        address _tokenAddress,
        uint256 _quantity
    ) external onlyActiveLottery(_lotteryId) onlyValidSessionKey(_user) nonReentrant {
        _purchaseTicketsFor(_user, _lotteryId, _tokenAddress, _quantity);
    }

    function batchPurchaseTickets(
        uint256[] calldata _lotteryIds,
        address[] calldata _tokenAddresses,
        uint256[] calldata _quantities
    ) external nonReentrant {
        require(
            _lotteryIds.length == _tokenAddresses.length &&
            _lotteryIds.length == _quantities.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < _lotteryIds.length; i++) {
            require(
                lotteries[_lotteryIds[i]].startTime <= block.timestamp &&
                lotteries[_lotteryIds[i]].endTime > block.timestamp,
                "Lottery is not active"
            );
            _purchaseTicketsFor(msg.sender, _lotteryIds[i], _tokenAddresses[i], _quantities[i]);
        }
    }

    function createSessionKey(
        address _sessionKey,
        uint256 _validUntil,
        bytes32 _operationsHash
    ) external {
        require(_sessionKey != address(0), "Invalid session key address");
        require(_validUntil > block.timestamp, "Expiration must be in the future");

        sessionKeys[_sessionKey] = SessionKey({
            user: msg.sender,
            key: _sessionKey,
            validUntil: _validUntil,
            operationsHash: _operationsHash
        });

        emit SessionKeyCreated(msg.sender, _sessionKey, _validUntil);
    }

    function revokeSessionKey(address _sessionKey) external {
        require(sessionKeys[_sessionKey].user == msg.sender, "Not your session key");

        delete sessionKeys[_sessionKey];

        emit SessionKeyRevoked(msg.sender, _sessionKey);
    }

    function drawLottery(uint256 _lotteryId, uint256 _randomSeed) external onlyOwner nonReentrant {
        Lottery storage lottery = lotteries[_lotteryId];

        require(block.timestamp >= lottery.drawTime, "Too early to draw");
        require(!lottery.drawn, "Lottery already drawn");
        require(lottery.totalTickets > 0, "No tickets sold");

        uint256 numberOfWinners = lottery.prizePool > 0 ?
            (lottery.prizePool / (lottery.ticketPrice * 2)) : 1;
        numberOfWinners = numberOfWinners > 0 ? numberOfWinners : 1;

        address[] memory winners = new address[](numberOfWinners);
        uint256[] memory winningTickets = new uint256[](numberOfWinners);
        uint256 ticketRange = lottery.totalTickets;

        for (uint256 i = 0; i < numberOfWinners; i++) {
            uint256 randomTicket = uint256(keccak256(abi.encode(_randomSeed, i))) % ticketRange + 1;
            UserTicket storage ticket = tickets[_lotteryId][randomTicket];

            winners[i] = ticket.user;
            winningTickets[i] = randomTicket;
        }

        lottery.winners = winners;
        lottery.winningTickets = winningTickets;
        lottery.drawn = true;

        emit LotteryDrawn(_lotteryId, winners);
    }

    function claimPrize(uint256 _lotteryId) external nonReentrant {
        Lottery storage lottery = lotteries[_lotteryId];

        require(lottery.drawn, "Lottery not drawn yet");

        bool _isWinner = false;
        for (uint256 i = 0; i < lottery.winners.length; i++) {
            if (lottery.winners[i] == msg.sender) {
                _isWinner = true;
                break;
            }
        }

        require(_isWinner, "You are not a winner");

        uint256 prizeAmount = lottery.prizePool / lottery.winners.length;

        // 仮に全員同一トークンで支払われた前提（現実にはトークン管理分離が必要）
        address tokenAddress = tickets[_lotteryId][lottery.winningTickets[0]].paymentToken;
        IERC20 token = IERC20(tokenAddress);
        require(token.transfer(msg.sender, prizeAmount), "Prize transfer failed");
    }

    function _purchaseTicketsFor(
        address _user,
        uint256 _lotteryId,
        address _tokenAddress,
        uint256 _quantity
    ) internal {
        Lottery storage lottery = lotteries[_lotteryId];

        require(_quantity > 0, "Must purchase at least one ticket");

        bool isSupported = false;
        for (uint256 i = 0; i < lottery.supportedTokens.length; i++) {
            if (lottery.supportedTokens[i] == _tokenAddress) {
                isSupported = true;
                break;
            }
        }
        require(isSupported, "Token not supported for this lottery");

        uint256 tokenAmount = lottery.ticketPrice * _quantity;

        IERC20 token = IERC20(_tokenAddress);
        require(token.transferFrom(_user, address(this), tokenAmount), "Token transfer failed");

        lottery.prizePool += tokenAmount;

        for (uint256 i = 0; i < _quantity; i++) {
            lottery.totalTickets++;
            uint256 ticketNumber = lottery.totalTickets;

            tickets[_lotteryId][ticketNumber] = UserTicket({
                lotteryId: _lotteryId,
                ticketNumber: ticketNumber,
                user: _user,
                paymentToken: _tokenAddress,
                amountPaid: tokenAmount / _quantity
            });

            userTickets[_user][_lotteryId].push(ticketNumber);

            emit TicketPurchased(_lotteryId, _user, ticketNumber, _tokenAddress);
        }
    }

    function getLottery(uint256 _lotteryId) external view returns (Lottery memory) {
        return lotteries[_lotteryId];
    }

    function getUserTickets(address _user, uint256 _lotteryId) external view returns (uint256[] memory) {
        return userTickets[_user][_lotteryId];
    }

    function isWinner(address _user, uint256 _lotteryId) external view returns (bool) {
        Lottery storage lottery = lotteries[_lotteryId];

        if (!lottery.drawn) return false;

        for (uint256 i = 0; i < lottery.winners.length; i++) {
            if (lottery.winners[i] == _user) {
                return true;
            }
        }

        return false;
    }
}
