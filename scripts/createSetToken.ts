import { ethers } from "hardhat";
import {
  BasicIssuanceModule__factory,
  ERC20__factory,
  SetTokenCreator__factory,
  StreamingFeeModule__factory,
  TradeModule__factory,
} from "../typechain";
import { ether } from "../utils/common";
import { ADDRESS_ZERO } from "../utils/constants";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";

const RNDR = "0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24"; // 20%
const wTAO = "0x77e06c9eccf2e797fd462a92b6d7642ef85b0a44"; // 20%
const ARKM = "0x6e2a43be0b1d33b726f0ca3b8de60b3482b8b050"; // 15%
const ASTRA = "0x0aA8A7D1fB4c64B3b1DcEa9A7ADe81C59C25b95b"; // 15%
const ZIG = "0xb2617246d0c6c0087f18703d576831899ca94f01"; // 10%
const PAAL = "0x14feE680690900BA0ccCfC76AD70Fd1b95D10e16"; // 10%
const BLENDR = "0x84018071282d4B2996272659D9C01cB08DD7327F"; // 10%

const tokens = [RNDR, wTAO, ARKM, ASTRA, ZIG, PAAL, BLENDR];
const weights = [0.2, 0.2, 0.15, 0.15, 0.1, 0.1, 0.1];

// Update these addresses
const SET_TOKEN_CREATOR_ADDRESS = "0xEc1fFD04c1E5e919801c1D7FDF6D786e2b2882cD";
const TRADE_MODULE_ADDRESS = "0x5585b2B7fd5eB12887b97C76204443A613816975";
const STREAMING_FEE_MODULE_ADDRESS = "0x0BD49A081DaccFb65Ad8c0452ab0Dda48CD40Abf";
const BASIC_ISSUANCE_MODULE_ADDRESS = "0xA1c8c28dcc714570EF038496D19Fdac138491f7f";

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

  const actualWeights = Array.from(Array(tokens.length).keys()).map((i) => BigNumber.from(0));
  for await (const [index, weight] of weights.entries()) {
    const decimals = await ERC20__factory.connect(tokens[index], signer).decimals();
    actualWeights[index] = parseUnits(weight.toString(), decimals);
  }
  console.log(
    "Deploying tokens with weights:",
    actualWeights.map((w) => w.toString()),
  );

  const tx = await setTokenCreator.create(
    tokens,
    actualWeights,
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
