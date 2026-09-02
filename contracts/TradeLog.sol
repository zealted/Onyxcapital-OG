// SPDX-License-Identifier: MIT
pragma solidity 0.8.19; // pinned — 0G's explorer verifier expects evmVersion cancun + solc 0.8.19

/// @title OnyxCapital TradeLog
/// @notice Minimal onchain trade log + reputation counter for OnyxCapital,
///         deployed on 0G Chain. Each trade a user places in the app is
///         hashed and logged here, giving a verifiable, tamper-proof
///         record of trading activity that anyone can check on the 0G
///         Explorer. This is intentionally simple for Wave 3 — depth
///         can grow in later Waves (streak bonuses, staking, etc).
contract TradeLog {
    struct Trade {
        address trader;
        bytes32 tradeHash;   // hash of { coin, side, amount, price, date } computed client-side
        string coin;         // e.g. "BTC"
        string side;         // "buy" | "sell"
        uint256 timestamp;
    }

    // trader => number of trades logged (their onchain "reputation" score)
    mapping(address => uint256) public tradeCount;

    // trader => list of trades (kept short/simple on purpose)
    mapping(address => Trade[]) private trades;

    event TradeLogged(
        address indexed trader,
        bytes32 indexed tradeHash,
        string coin,
        string side,
        uint256 timestamp
    );

    /// @notice Log a trade for msg.sender. Called from the OnyxCapital frontend
    ///         right after a (paper) trade is placed.
    function logTrade(bytes32 tradeHash, string calldata coin, string calldata side) external {
        trades[msg.sender].push(Trade({
            trader: msg.sender,
            tradeHash: tradeHash,
            coin: coin,
            side: side,
            timestamp: block.timestamp
        }));
        tradeCount[msg.sender] += 1;

        emit TradeLogged(msg.sender, tradeHash, coin, side, block.timestamp);
    }

    /// @notice Number of trades a given address has logged onchain.
    function getTradeCount(address trader) external view returns (uint256) {
        return tradeCount[trader];
    }

    /// @notice Fetch a specific logged trade for a trader by index.
    function getTrade(address trader, uint256 index) external view returns (Trade memory) {
        return trades[trader][index];
    }

    /// @notice Total trades a trader has (for pagination on the frontend).
    function getTradeHistoryLength(address trader) external view returns (uint256) {
        return trades[trader].length;
    }
}
