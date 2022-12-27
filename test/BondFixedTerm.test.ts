import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "bignumber.js";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import {
  BondAggregator,
  BondAggregator__factory,
  BondFixedTermSDA,
  BondFixedTermSDA__factory,
  BondFixedTermTeller,
  BondFixedTermTeller__factory,
  MockERC20,
  MockERC20__factory,
  MockRolesAuthority,
  MockRolesAuthority__factory,
} from "../typechain-types";
import { ZERO_ADDRESS, getInitialPrice, latest, encodeMarketParams, ONE_DAY, advanceTimeAndBlock } from "./utils";

BigNumber.config({ EXPONENTIAL_AT: 100, ROUNDING_MODE: BigNumber.ROUND_DOWN });


describe("BondFixedTerm", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let bondFixedTermTeller: BondFixedTermTeller;
  let bondFixedTermSDA: BondFixedTermSDA;
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

    const BondFixedTermTellerFactory = new BondFixedTermTeller__factory(owner);
    bondFixedTermTeller = await BondFixedTermTellerFactory.deploy(
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
      .approve(bondFixedTermTeller.address, parseEther("100000"));

    await ohm.mint(owner.address, parseEther("100000"));
    await ohm.approve(bondFixedTermTeller.address, parseEther("100000"));

    const BondFixedTermSDAFactory = new BondFixedTermSDA__factory(owner);

    bondFixedTermSDA = await BondFixedTermSDAFactory.deploy(
      bondFixedTermTeller.address,
      bondAggregator.address,
      owner.address,
      rolesAuthority.address
    );

    await bondAggregator.registerAuctioneer(bondFixedTermSDA.address);
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

      await expect(bondFixedTermSDA.createMarket(marketParams))
        .to.emit(bondFixedTermSDA, "MarketCreated")
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
        "86400",
        conclusion.toString(),
        "14400",
        scaleAdjustment.toString()
      );

      await expect(bondFixedTermSDA.createMarket(marketParams))
        .to.emit(bondFixedTermSDA, "MarketCreated")
        .withArgs(0, ohm.address, dai.address, 86400, initialPrice);
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

        const conclusion = (await latest()).plus(ONE_DAY + 50);

        const marketParams = encodeMarketParams(
          ohm.address,
          dai.address,
          ZERO_ADDRESS,
          false,
          "10000000000000",
          initialPrice,
          minimumPrice,
          "10000",
          "86400",
          conclusion.toString(),
          "14400",
          scaleAdjustment.toString()
        );

        await bondFixedTermSDA.createMarket(marketParams);
      });

      it("should be able to buy bonds with vesting", async () => {
        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("100000")
        );

        await expect(
          bondFixedTermTeller
            .connect(alice)
            .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0")
        )
          .to.emit(bondFixedTermTeller, "Bonded")
          .withArgs(0, ZERO_ADDRESS, parseEther("10"), "1428576940");

        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("99990")
        );
      });

      it("should be able to redeem bond if matured", async () => {
        expect(await ohm.balanceOf(alice.address)).to.equal("0");

        const tx = await bondFixedTermTeller
          .connect(alice)
          .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0");
        const receipt = await tx.wait();
        const tokenId = receipt.events?.[5].args?.[0];

        await advanceTimeAndBlock(86500);

        await bondFixedTermTeller.connect(alice).redeem(tokenId, "1428576940");

        expect(await ohm.balanceOf(alice.address)).to.equal("1428576940");
      });

      it("should fail to redeem bond if not matured", async () => {
        const tx = await bondFixedTermTeller
          .connect(alice)
          .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0");
        const receipt = await tx.wait();
        const tokenId = receipt.events?.[5].args?.[0].toString();

        const bondAmount = await bondFixedTermTeller.balanceOf(
          alice.address,
          tokenId
        );

        await expect(
          bondFixedTermTeller.connect(alice).redeem(tokenId, bondAmount)
        ).to.be.rejected;
      });

      it("should fail to purchase if bond expired", async () => {
        await advanceTimeAndBlock(+ONE_DAY + 60);

        await expect(
          bondFixedTermTeller.purchase(
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

        await bondFixedTermSDA.createMarket(marketParams);
      });

      it("should be able to receive payout tokens on purchase", async () => {
        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("100000")
        );

        await expect(
          bondFixedTermTeller
            .connect(alice)
            .purchase(alice.address, ZERO_ADDRESS, 0, parseEther("10"), "0")
        )
          .to.emit(bondFixedTermTeller, "Bonded")
          .withArgs(0, ZERO_ADDRESS, parseEther("10"), "1428576940");

        expect(await dai.balanceOf(alice.address)).to.equal(
          parseEther("99990")
        );
        expect(await ohm.balanceOf(alice.address)).to.equal("1428576940");
      });
    });
  });
});
