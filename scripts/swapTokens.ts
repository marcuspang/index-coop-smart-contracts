import { ethers } from "hardhat";
import {
  BasicIssuanceModule__factory,
  ERC20__factory,
  SetToken__factory,
  UniswapV2Factory__factory,
  UniswapV2Pair__factory,
  UniswapV2Router02__factory,
} from "../typechain";
import { ether } from "../utils/common";

const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAP_V3_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const UNISWAP_V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const BNB = "0xB8c77482e45F1F44dE1745F52C74426C631bDD52";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Update these addresses
const BASIC_ISSUANCE_MODULE_ADDRESS = "0xc7B78A62472d110b6368E6564751Eb7F6D6c69e9";
const SET_TOKEN_ADDRESS = "0x384DcF2909B81e80462E07409B1bfA310eB64EfD";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Deploying with account:", signer.address, "balance:", balance.toString());

  const basicIssuanceModule = BasicIssuanceModule__factory.connect(
    BASIC_ISSUANCE_MODULE_ADDRESS,
    signer,
  );
  const setToken = SetToken__factory.connect(SET_TOKEN_ADDRESS, signer);
  const uniswapV2Factory = UniswapV2Factory__factory.connect(UNISWAP_V2_FACTORY_ADDRESS, signer);
  const uniswapV2Router02 = UniswapV2Router02__factory.connect(UNISWAP_V2_ROUTER_ADDRESS, signer);

  const bnb = ERC20__factory.connect(BNB, signer);
  await bnb.approve(basicIssuanceModule.address, ether(2));
  const usdc = ERC20__factory.connect(USDC, signer);
  await usdc.approve(basicIssuanceModule.address, ether(2));

  console.log("BNB Balance:", await bnb.balanceOf(signer.address));
  console.log("USDC Balance:", await usdc.balanceOf(signer.address));

  await basicIssuanceModule.issue(SET_TOKEN_ADDRESS, ether(1), signer.address);
  console.log(
    "SetToken minted to:",
    signer.address,
    "balance:",
    (await setToken.balanceOf(signer.address)).toString(),
  );

  const WETH = await uniswapV2Router02.WETH();

  await uniswapV2Factory.createPair(BNB, setToken.address);
  await uniswapV2Factory.createPair(USDC, setToken.address);
  await uniswapV2Factory.createPair(WETH, setToken.address);

  const bnbPairAddress = await uniswapV2Factory.getPair(BNB, setToken.address);
  const bnbPair = UniswapV2Pair__factory.connect(bnbPairAddress, signer);
  const usdcPairAddress = await uniswapV2Factory.getPair(USDC, setToken.address);
  const usdcPair = UniswapV2Pair__factory.connect(usdcPairAddress, signer);
  const ethPairAddress = await uniswapV2Factory.getPair(WETH, setToken.address);
  const ethPair = UniswapV2Pair__factory.connect(ethPairAddress, signer);
  console.log("BNB-SET Pair deployed to:", bnbPairAddress);
  console.log("USDC-SET Pair deployed to:", usdcPairAddress);
  console.log("ETH-SET Pair deployed to:", ethPairAddress);

  await setToken.approve(UNISWAP_V2_ROUTER_ADDRESS, ether(99));

  const beforeReserves = await ethPair.getReserves();
  console.log({ beforeReserves });

  await uniswapV2Router02.addLiquidityETH(
    setToken.address,
    ether(1),
    1,
    1,
    signer.address,
    999999999999999,
    { value: ether(1) },
  );

  const afterReserves = await ethPair.getReserves();
  console.log({ afterReserves });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
