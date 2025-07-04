// contract/AlpacaLotto.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IPacaLuckToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

contract AlpacaLotto is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    uint256 public lotteryCounter;
    address public priceOracle;
    IPacaLuckToken public pacaLuckToken;

    uint256 public constant PLT_TICKET_COST = 100 * 10**18;
    uint256 public constant PLT_DAILY_REWARD = 10 * 10**18;

    constructor(address _initialOwner, address _priceOracle, address _pacaLuckTokenAddress) Ownable(_initialOwner) {
        priceOracle = _priceOracle;
        pacaLuckToken = IPacaLuckToken(_pacaLuckTokenAddress);
    }

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

    mapping(address => bool) public hasMadeFirstPurchase;
    mapping(address => uint256) public cumulativeTicketsPurchased;
    mapping(address => uint256) public lastCheckIn;


    event LotteryCreated(uint256 indexed lotteryId, string name, uint256 ticketPrice);
    event TicketPurchased(uint256 indexed lotteryId, address indexed user, uint256 ticketNumber, address paymentToken);
    event LotteryDrawn(uint256 indexed lotteryId, address[] winners);
    event SessionKeyCreated(address indexed user, address indexed key, uint256 validUntil);
    event SessionKeyRevoked(address indexed user, address indexed key);
    event ReferralRecorded(address indexed referrer, address indexed referee);
    event MilestoneAchieved(address indexed user, uint256 ticketsPurchased);
    event DailyCheckIn(address indexed user, uint256 amount);


    modifier onlyActiveLottery(uint256 _lotteryId) {
        require(lotteries[_lotteryId].id != 0, "Lottery does not exist");
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
        require(_ticketPrice >= 10**14, "Ticket price too low. Min 0.0001 tokens with 18 decimals.");

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

    function addSupportedToken(uint256 lotteryId, address token) external onlyOwner {
        require(lotteries[lotteryId].id != 0, "Lottery does not exist");
        require(token != address(0), "Invalid token address");
        Lottery storage lottery = lotteries[lotteryId];
        
        for (uint256 i = 0; i < lottery.supportedTokens.length; i++) {
            if (lottery.supportedTokens[i] == token) {
                revert("Token already supported");
            }
        }
        lottery.supportedTokens.push(token);
    }

    function purchaseTickets(uint256 _lotteryId, address _tokenAddress, uint256 _quantity) external onlyActiveLottery(_lotteryId) nonReentrant {
        _purchaseTicketsFor(msg.sender, _lotteryId, _tokenAddress, _quantity, address(0));
    }
    
    function purchaseTicketsWithReferral(uint256 _lotteryId, address _tokenAddress, uint256 _quantity, address _referrer) external onlyActiveLottery(_lotteryId) nonReentrant {
        _purchaseTicketsFor(msg.sender, _lotteryId, _tokenAddress, _quantity, _referrer);
    }
    
    function purchaseTicketsWithPLT(uint256 _lotteryId, uint256 _quantity) external onlyActiveLottery(_lotteryId) nonReentrant {
        require(_quantity > 0, "Must purchase at least one ticket");
        uint256 totalPLTCost = PLT_TICKET_COST * _quantity;
        
        pacaLuckToken.transferFrom(msg.sender, address(this), totalPLTCost);

        _mintTickets(msg.sender, _lotteryId, address(pacaLuckToken), _quantity, PLT_TICKET_COST);
    }

    function dailyCheckIn() external nonReentrant {
        require(block.timestamp >= lastCheckIn[msg.sender] + 24 hours, "Daily check-in: Wait 24 hours");
        lastCheckIn[msg.sender] = block.timestamp;

        pacaLuckToken.mint(msg.sender, PLT_DAILY_REWARD);

        emit DailyCheckIn(msg.sender, PLT_DAILY_REWARD);
    }

    function drawLottery(uint256 _lotteryId, uint256 _randomSeed) external onlyOwner nonReentrant {
        Lottery storage lottery = lotteries[_lotteryId];
        require(lottery.id != 0, "Lottery does not exist");
        require(block.timestamp >= lottery.drawTime, "Too early to draw");
        require(!lottery.drawn, "Lottery already drawn");
        require(lottery.totalTickets > 0, "No tickets sold");

        uint256 numberOfWinners = lottery.prizePool > 0 ?
            (lottery.prizePool / (lottery.ticketPrice * 2)) : 1; 
        numberOfWinners = numberOfWinners > 0 ? numberOfWinners : 1;
        numberOfWinners = numberOfWinners > lottery.totalTickets ? lottery.totalTickets : numberOfWinners;

        address[] memory winners = new address[](numberOfWinners);
        uint256[] memory winningTickets = new uint256[](numberOfWinners);
        uint256 ticketRange = lottery.totalTickets;
        
        bool[] memory alreadyWinningTicketFlags = new bool[](ticketRange + 1);

        for (uint256 i = 0; i < numberOfWinners; ) {
            uint256 randomTicketNumber = uint256(keccak256(abi.encode(_randomSeed, i, block.timestamp))) % ticketRange + 1;
            if (!alreadyWinningTicketFlags[randomTicketNumber] && tickets[_lotteryId][randomTicketNumber].user != address(0)) {
                UserTicket storage ticket = tickets[_lotteryId][randomTicketNumber];
                winners[i] = ticket.user;
                winningTickets[i] = randomTicketNumber;
                alreadyWinningTicketFlags[randomTicketNumber] = true;
                i++;
            }
        }

        lottery.winners = winners;
        lottery.winningTickets = winningTickets;
        lottery.drawn = true;

        emit LotteryDrawn(_lotteryId, winners);
    }

    function claimPrize(uint256 _lotteryId) external nonReentrant {
        Lottery storage lottery = lotteries[_lotteryId];
        require(lottery.id != 0, "Lottery does not exist");
        require(lottery.drawn, "Lottery not drawn yet");

        bool _isWinner = false;
        uint256 winningTicketIndex = 0; 
        address prizeTokenAddress = address(0);

        for (uint256 i = 0; i < lottery.winners.length; i++) {
            if (lottery.winners[i] == msg.sender) {
                _isWinner = true;
                winningTicketIndex = i; 
                prizeTokenAddress = tickets[_lotteryId][lottery.winningTickets[i]].paymentToken;
                break;
            }
        }
        require(_isWinner, "You are not a winner or prize already claimed");
        
        uint256 prizeAmountPerWinner = lottery.prizePool / lottery.winners.length;
        
        lottery.winners[winningTicketIndex] = address(0); 

        IERC20 token = IERC20(prizeTokenAddress);
        require(token.transfer(msg.sender, prizeAmountPerWinner), "Prize transfer failed");
    }

    function _purchaseTicketsFor(
        address _user,
        uint256 _lotteryId,
        address _tokenAddress,
        uint256 _quantity,
        address _referrer
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
        
        _mintTickets(_user, _lotteryId, _tokenAddress, _quantity, lottery.ticketPrice);

        if (!hasMadeFirstPurchase[_user] && _referrer != address(0) && _referrer != _user) {
            emit ReferralRecorded(_referrer, _user);
        }
        hasMadeFirstPurchase[_user] = true;
    }

    function _mintTickets(address _user, uint256 _lotteryId, address _paymentToken, uint256 _quantity, uint256 _pricePerTicket) internal {
        Lottery storage lottery = lotteries[_lotteryId];
        uint256 previousTicketsCount = cumulativeTicketsPurchased[_user];
        cumulativeTicketsPurchased[_user] += _quantity;

        if ((previousTicketsCount < 10 && cumulativeTicketsPurchased[_user] >= 10) ||
            (previousTicketsCount < 50 && cumulativeTicketsPurchased[_user] >= 50) ||
            (previousTicketsCount < 100 && cumulativeTicketsPurchased[_user] >= 100)) {
             emit MilestoneAchieved(_user, cumulativeTicketsPurchased[_user]);
        }

        for (uint256 i = 0; i < _quantity; i++) {
            lottery.totalTickets++;
            uint256 ticketNumber = lottery.totalTickets;

            tickets[_lotteryId][ticketNumber] = UserTicket({
                lotteryId: _lotteryId,
                ticketNumber: ticketNumber,
                user: _user,
                paymentToken: _paymentToken,
                amountPaid: _pricePerTicket
            });
            userTickets[_user][_lotteryId].push(ticketNumber);
            emit TicketPurchased(_lotteryId, _user, ticketNumber, _paymentToken);
        }
    }

    function getLottery(uint256 _lotteryId) external view returns (Lottery memory) {
        require(lotteries[_lotteryId].id != 0, "Lottery does not exist");
        return lotteries[_lotteryId];
    }

    function getUserTickets(address _user, uint256 _lotteryId) external view returns (uint256[] memory) {
        require(lotteries[_lotteryId].id != 0, "Lottery does not exist");
        return userTickets[_user][_lotteryId];
    }

    function isWinner(address _user, uint256 _lotteryId) external view returns (bool) {
        Lottery storage lottery = lotteries[_lotteryId];
        require(lottery.id != 0, "Lottery does not exist");
        if (!lottery.drawn) return false;
        for (uint256 i = 0; i < lottery.winners.length; i++) {
            if (lottery.winners[i] == _user) {
                return true;
            }
        }
        return false;
    }

    function checkUpkeep(bytes calldata /* checkData */) external view returns (bool upkeepNeeded, bytes memory performData) {
        uint256 count = lotteryCounter;
        for (uint256 i = 1; i <= count; i++) {
            Lottery storage lottery = lotteries[i];
            if (!lottery.drawn && block.timestamp >= lottery.drawTime && lottery.totalTickets > 0) {
                upkeepNeeded = true;
                performData = abi.encode(i);
                return (upkeepNeeded, performData);
            }
        }
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external nonReentrant {
        (bool upkeepNeeded, ) = this.checkUpkeep("");
        require(upkeepNeeded, "Upkeep not needed");

        uint256 lotteryId = abi.decode(performData, (uint256));
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao)));
        this.drawLottery(lotteryId, randomSeed);
    }
}