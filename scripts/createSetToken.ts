import { ethers } from "hardhat";
import {
  BasicIssuanceModule__factory,
  SetTokenCreator__factory,
  StreamingFeeModule__factory,
  TradeModule__factory,
} from "../typechain";
import { ether } from "../utils/common";
import { ADDRESS_ZERO } from "../utils/constants";

const BNB = "0xB8c77482e45F1F44dE1745F52C74426C631bDD52";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Update these addresses
const SET_TOKEN_CREATOR_ADDRESS = "0x55E36d760975158B17Df31a3F60a41fD3a452D35";
const TRADE_MODULE_ADDRESS = "0xafDE3dc450CfFC52BfaA78b3a550B6b6685db8f6";
const STREAMING_FEE_MODULE_ADDRESS = "0xf467ad9F123c5868af2a0Af93B748e4B8530A3A6";
const BASIC_ISSUANCE_MODULE_ADDRESS = "0xc7B78A62472d110b6368E6564751Eb7F6D6c69e9";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Deploying with account:", signer.address, "balance:", balance.toString());

  const basicIssuanceModule = BasicIssuanceModule__factory.connect(
    BASIC_ISSUANCE_MODULE_ADDRESS,
    signer,
  );
  const streamingFeeModule = StreamingFeeModule__factory.connect(
    STREAMING_FEE_MODULE_ADDRESS,
    signer,
  );
  const tradeModule = TradeModule__factory.connect(TRADE_MODULE_ADDRESS, signer);
  const setTokenCreator = SetTokenCreator__factory.connect(SET_TOKEN_CREATOR_ADDRESS, signer);

  const tx = await setTokenCreator.create(
    [BNB, USDC],
    [ether(1), ether(1)],
    [BASIC_ISSUANCE_MODULE_ADDRESS, STREAMING_FEE_MODULE_ADDRESS, TRADE_MODULE_ADDRESS],
    signer.address,
    "My SetToken",
    "MST",
  );
  const receipt = await tx.wait();
  const setTokenAddress = (receipt.events?.[1]?.args as string[])[0];
  console.log("SetToken deployed to:", setTokenAddress);

  // Initialize modules
  await basicIssuanceModule.initialize(setTokenAddress, ADDRESS_ZERO);
  await streamingFeeModule.initialize(setTokenAddress, {
    feeRecipient: signer.address,
    maxStreamingFeePercentage: 0,
    streamingFeePercentage: 0,
    lastStreamingFeeTimestamp: 0,
  });
  await tradeModule.initialize(setTokenAddress);
  console.log("Added modules to SetToken");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
