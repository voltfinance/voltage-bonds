import { ethers } from "hardhat";
import { BigNumber } from "bignumber.js";

export async function latest() {
  const block = await ethers.provider.getBlock("latest");
  return new BigNumber(block.timestamp);
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const ONE_DAY = 86400;

export function getInitialPrice(
  payoutPrice: number,
  quotePrice: number,
  scaleAdjustment: number,
  payoutDecimals: number,
  quoteDecimals: number,
  payoutPriceDecimals: number,
  quotePriceDecimals: number
) {
  return new BigNumber(new BigNumber(payoutPrice).div(quotePrice)).multipliedBy(
    new BigNumber("10").pow(
      new BigNumber("36")
        .plus(scaleAdjustment)
        .plus(new BigNumber(quoteDecimals).minus(payoutDecimals))
        .plus(new BigNumber(payoutPriceDecimals).minus(quotePriceDecimals))
    )
  );
}

export function encodeMarketParams(
  payoutToken: string,
  quoteToken: string,
  callbackAddr: string,
  capacityInQuote: boolean,
  capacity: string,
  formattedInitialPrice: string,
  formattedMinimumPrice: string,
  debtBuffer: string,
  vesting: string,
  conclusion: string,
  depositInterval: string,
  scaleAdjustment: string
) {
  return ethers.utils.defaultAbiCoder.encode(
    [
      "address",
      "address",
      "address",
      "bool",
      "uint256",
      "uint256",
      "uint256",
      "uint32",
      "uint48",
      "uint48",
      "uint32",
      "int8",
    ],
    [
      payoutToken,
      quoteToken,
      callbackAddr,
      capacityInQuote,
      capacity,
      formattedInitialPrice,
      formattedMinimumPrice,
      debtBuffer,
      vesting,
      conclusion,
      depositInterval,
      scaleAdjustment,
    ]
  );
}

export function advanceBlock() {
  return ethers.provider.send("evm_mine", []);
}

export async function advanceTime(time: number | string) {
  await ethers.provider.send("evm_increaseTime", [time]);
}

export async function advanceTimeAndBlock(time: number | string) {
  await advanceTime(time);
  await advanceBlock();
}
