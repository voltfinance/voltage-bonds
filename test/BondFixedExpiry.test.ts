import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { BondAggregator, MockRolesAuthority, MockERC20, MockRolesAuthority__factory, BondAggregator__factory, BondFixedTermTeller__factory, MockERC20__factory, BondFixedTermSDA__factory, BondFixedExpiryTeller, BondFixedExpirySDA, BondFixedExpiryTeller__factory, BondFixedExpirySDA__factory } from "../typechain-types";
import { advanceTimeAndBlock, encodeMarketParams, getInitialPrice, latest, ONE_DAY, ZERO_ADDRESS } from "./utils";
import { expect } from "chai";
import { BigNumber } from "bignumber.js";

describe('BondFixedExpiry', () => {
      let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let bondFixedExpiryTeller: BondFixedExpiryTeller;
  let bondFixedExpirySDA: BondFixedExpirySDA;
  let bondAggregator: BondAggregator;
  let rolesAuthority: MockRolesAuthority;
  let dai: MockERC20;
  let ohm: MockERC20;

  beforeEach(async () => {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    alice = accounts[1];

    const MockRolesAuthorityFactory = new MockRolesAuthority__factory(owner);
    rolesAuthority = await MockRolesAuthorityFactory.deploy(
      owner.address,
      ZERO_ADDRESS
    );

    const BondAggregatorFactory = new BondAggregator__factory(owner);
    bondAggregator = await BondAggregatorFactory.deploy(
      owner.address,
      rolesAuthority.address
    );

    const BondFixedExpiryTellerFactory = new BondFixedExpiryTeller__factory(owner);
    bondFixedExpiryTeller = await BondFixedExpiryTellerFactory.deploy(
      owner.address,
      bondAggregator.address,
      owner.address,
      rolesAuthority.address
    );

    const MockERC20Factory = new MockERC20__factory(owner);
    dai = await MockERC20Factory.deploy("Dai", "DAI", 18);
    ohm = await MockERC20Factory.deploy("Ohm", "OHM", 9);

    await dai.mint(alice.address, parseEther("100000"));
    await dai
      .connect(alice)
      .approve(bondFixedExpiryTeller.address, parseEther("100000"));

    await ohm.mint(owner.address, parseEther("100000"));
    await ohm.approve(bondFixedExpiryTeller.address, parseEther("100000"));

    const BondFixedExpirySDAFactory = new BondFixedExpirySDA__factory(owner);

    bondFixedExpirySDA = await BondFixedExpirySDAFactory.deploy(
      bondFixedExpiryTeller.address,
      bondAggregator.address,
      owner.address,
      rolesAuthority.address
    );

    await bondAggregator.registerAuctioneer(bondFixedExpirySDA.address);
  });

  describe("admin", () => {
    let payoutDecimals: number;
    let quoteDecimals: number;
    let scaleAdjustment: number;
    let payoutPrice: number;
    let quotePrice: number;
    let payoutPriceDecimals: number;
    let quotePriceDecimals: number;

    beforeEach(async () => {
      payoutDecimals = await ohm.decimals();
      quoteDecimals = await dai.decimals();
      scaleAdjustment = payoutDecimals - quoteDecimals;
      payoutPrice = 7;
      quotePrice = 1;
      payoutPriceDecimals = 18;
      quotePriceDecimals = 18;
    });

    it("should be able to create market with no vesting", async () => {
      const initialPrice = getInitialPrice(
        payoutPrice,
        quotePrice,
        scaleAdjustment,
        payoutDecimals,
        quoteDecimals,
        payoutPriceDecimals,
        quotePriceDecimals
      ).toString();
      const minimumPrice = new BigNumber(6)
        .multipliedBy(new BigNumber(10).pow(36))
        .toString();

      const conclusion = (await latest()).plus(ONE_DAY * 2);

      const marketParams = encodeMarketParams(
        ohm.address,
        dai.address,
        ZERO_ADDRESS,
        false,
        "10000000000000",
        initialPrice,
        minimumPrice,
        "10000",
        "0",
        conclusion.toString(),
        "14400",
        scaleAdjustment.toString()
      );

      await expect(bondFixedExpirySDA.createMarket(marketParams))
        .to.emit(bondFixedExpirySDA, "MarketCreated")
        .withArgs(0, ohm.address, dai.address, 0, initialPrice);
    });

    it("should be able to create market with vesting", async () => {
      const initialPrice = getInitialPrice(
        payoutPrice,
        quotePrice,
        scaleAdjustment,
        payoutDecimals,
        quoteDecimals,
        payoutPriceDecimals,
        quotePriceDecimals
      ).toString();

      const minimumPrice = new BigNumber(6)
        .multipliedBy(new BigNumber(10).pow(36))
        .toString();

      const conclusion = (await latest()).plus(ONE_DAY * 2);

      const marketParams = encodeMarketParams(
        ohm.address,
        dai.address,
        ZERO_ADDRESS,
        false,
        "10000000000000",
        initialPrice,
        minimumPrice,
        "10000",
        conclusion.plus(ONE_DAY).toString(),
        conclusion.toString(),
        "14400",
        scaleAdjustment.toString()
      );

      await expect(bondFixedExpirySDA.createMarket(marketParams))
        .to.emit(bondFixedExpirySDA, "MarketCreated")
        .withArgs(0, ohm.address, dai.address, 1672358400, initialPrice);
    });
  });

  describe("user", () => {
    let payoutDecimals: number;
    let quoteDecimals: number;
    let scaleAdjustment: number;
    let payoutPrice: number;
    let quotePrice: number;
    let payoutPriceDecimals: number;
    let quotePriceDecimals: number;

    beforeEach(async () => {
      payoutDecimals = await ohm.decimals();
      quoteDecimals = await dai.decimals();
      scaleAdjustment = payoutDecimals - quoteDecimals;
      payoutPrice = 7;
      quotePrice = 1;
      payoutPriceDecimals = 18;
      quotePriceDecimals = 18;
    });

    describe("vested", () => {
      let marketParams: any
      let conclusion: any
      
      beforeEach(async () => {
        const initialPrice = getInitialPrice(
          payoutPrice,
          quotePrice,
          scaleAdjustment,
          payoutDecimals,
          quoteDecimals,
          payoutPriceDecimals,
          quotePriceDecimals
        ).toString();

        const minimumPrice = new BigNumber(6)
          .multipliedBy(new BigNumber(10).pow(36))
          .toString();

        conclusion = (await latest()).plus(ONE_DAY + 50);

        marketParams = encodeMarketParams(
          ohm.address,
          dai.address,
          ZERO_ADDRESS,
          false,
          "10000000000000",
          initialPrice,
          minimumPrice,
          "10000",
          conclusion.plus(ONE_DAY * 2).toString(),
          conclusion.toString(),
          "14400",
          scaleAdjustment.toString()
        );
      });

      it("should be able to buy bonds with vesting", async () => {
        await bondFixedExpirySDA.createMarket(marketParams);

        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("100000")
        );

        await expect(
          bondFixedExpiryTeller
            .connect(alice)
            .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0")
        )
          .to.emit(bondFixedExpiryTeller, "Bonded")
          .withArgs(0, ZERO_ADDRESS, parseEther("10"), "1428576940");

        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("99990")
        );
      });

      it("should be able to redeem bond if matured", async () => {
        await bondFixedExpirySDA.createMarket(marketParams);

        const bondToken = await bondFixedExpiryTeller.getBondToken(ohm.address, conclusion.plus(ONE_DAY * 2).toString())

        expect(await ohm.balanceOf(alice.address)).to.equal("0");

        await bondFixedExpiryTeller
          .connect(alice)
          .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0");

        await advanceTimeAndBlock((ONE_DAY * 3));

        await bondFixedExpiryTeller.connect(alice).redeem(bondToken, "1428576940");

        expect(await ohm.balanceOf(alice.address)).to.equal("1428576940");
      });

      it("should fail to redeem bond if not matured", async () => {
        await bondFixedExpirySDA.createMarket(marketParams);

        const bondToken = await bondFixedExpiryTeller.getBondToken(ohm.address, conclusion.plus(ONE_DAY * 2).toString())

        await bondFixedExpiryTeller
          .connect(alice)
          .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0");

        await expect(
          bondFixedExpiryTeller.connect(alice).redeem(bondToken, "1428576940")
        ).to.be.rejected;
      });

      it("should fail to purchase if bond expired", async () => {
        await advanceTimeAndBlock((ONE_DAY * 2) + 50);

        await expect(
          bondFixedExpiryTeller.connect(alice).purchase(
            alice.address,
            ZERO_ADDRESS,
            0,
            parseEther("10"),
            "0"
          )
        ).to.be.reverted;
      });
    });

    describe("instant swap", () => {
      beforeEach(async () => {
        const initialPrice = getInitialPrice(
          payoutPrice,
          quotePrice,
          scaleAdjustment,
          payoutDecimals,
          quoteDecimals,
          payoutPriceDecimals,
          quotePriceDecimals
        ).toString();

        const minimumPrice = new BigNumber(6)
          .multipliedBy(new BigNumber(10).pow(36))
          .toString();

        const conclusion = (await latest()).plus(106400);

        const marketParams = encodeMarketParams(
          ohm.address,
          dai.address,
          ZERO_ADDRESS,
          false,
          "10000000000000",
          initialPrice,
          minimumPrice,
          "10000",
          "0",
          conclusion.toString(),
          "14400",
          scaleAdjustment.toString()
        );

        await bondFixedExpirySDA.createMarket(marketParams);
      });

      it("should be able to receive payout tokens on purchase", async () => {
        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("100000")
        );

        await expect(
          bondFixedExpiryTeller
            .connect(alice)
            .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0")
        )
          .to.emit(bondFixedExpiryTeller, "Bonded")
          .withArgs(0, ZERO_ADDRESS, parseEther("10"), "1428576940");

        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("99990")
        );
        expect(await ohm.balanceOf(alice.address)).to.equal("1428576940");
      });
    });
  });
})