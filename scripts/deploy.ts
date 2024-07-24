import { ethers } from "hardhat";
import DeployHelper from "../utils/deploys/index";

const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAP_V3_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Deploying with account:", signer.address, "balance:", balance.toString());
  const deployer = new DeployHelper(signer);

  // Deploy Controller
  const feeRecipient = signer.address;
  const controller = await deployer.setV2.deployController(feeRecipient);
  console.log("Controller deployed to:", controller.address);

  // Deploy SetTokenCreator
  const setTokenCreator = await deployer.setV2.deploySetTokenCreator(controller.address);
  console.log("SetTokenCreator deployed to:", setTokenCreator.address);

  // Deploy other necessary modules
  const basicIssuanceModule = await deployer.setV2.deployBasicIssuanceModule(controller.address);
  const streamingFeeModule = await deployer.setV2.deployStreamingFeeModule(controller.address);
  const tradeModule = await deployer.setV2.deployTradeModule(controller.address);
  console.log("TradeModule deployed to:", tradeModule.address);
  console.log("StreamingFeeModule deployed to:", streamingFeeModule.address);
  console.log("BasicIssuanceModule deployed to:", basicIssuanceModule.address);

  await controller.initialize(
    [setTokenCreator.address],
    [basicIssuanceModule.address, streamingFeeModule.address, tradeModule.address],
    [],
    [],
  );

  // Deploy integrations
  const uniswapV2ExchangeAdapter =
    await deployer.setV2.deployUniswapV2ExchangeAdapter(UNISWAP_V2_ROUTER_ADDRESS);
  const uniswapV3ExchangeAdapter =
    await deployer.setV2.deployUniswapV3ExchangeAdapter(UNISWAP_V3_ROUTER_ADDRESS);
  const integrationRegistry = await deployer.setV2.deployIntegrationRegistry(controller.address);
  await integrationRegistry.batchAddIntegration(
    [tradeModule.address, tradeModule.address],
    ["UniswapV2ExchangeAdapterV2", "UniswapV3ExchangeAdapterV2"],
    [uniswapV2ExchangeAdapter.address, uniswapV3ExchangeAdapter.address],
  );
  console.log("IntegrationRegistry deployed to:", integrationRegistry.address);
  console.log("UniswapV2ExchangeAdapter deployed to:", uniswapV2ExchangeAdapter.address);
  console.log("UniswapV3ExchangeAdapter deployed to:", uniswapV3ExchangeAdapter.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
