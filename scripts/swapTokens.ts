import { ethers } from "hardhat";
import {
  BasicIssuanceModule__factory,
  ERC20__factory,
  SetToken__factory,
  UniswapV2Factory__factory,
  UniswapV2Pair__factory,
  UniswapV2Router02__factory,
  UniswapV3Factory__factory,
} from "../typechain";
import { ether } from "../utils/common";
import { ZERO_BYTES } from "../utils/constants";

const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAP_V3_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const UNISWAP_V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

// Update these addresses
const BASIC_ISSUANCE_MODULE_ADDRESS = "0xc7B78A62472d110b6368E6564751Eb7F6D6c69e9";
const SET_TOKEN_ADDRESS = "0xeA5a5C9E7074Eda371A1E93171C5bf0659772913";

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

  const positions = await setToken.getPositions();

  // for await (const position of positions) {
  //   const erc20 = ERC20__factory.connect(position.component, signer);
  //   await erc20.approve(basicIssuanceModule.address, ether(100));
  //   console.log(position.component, " Balance:", await erc20.balanceOf(signer.address));
  // }

  await basicIssuanceModule.issue(SET_TOKEN_ADDRESS, ether(0.1), signer.address);
  const newBalance = await setToken.balanceOf(signer.address);
  console.log("SetToken minted to:", signer.address, "balance:", newBalance);

  const WETH = await uniswapV2Router02.WETH();

  // for await (const position of positions) {
  //   const v2PairAddress = await uniswapV2Factory.getPair(position.component, setToken.address);
  //   console.log(position.component, " Pair Address:", v2PairAddress);
  //   if (v2PairAddress !== "0x0000000000000000000000000000000000000000") {
  //     const v2Pair = UniswapV2Pair__factory.connect(v2PairAddress, signer);
  //     const reserves = await v2Pair.getReserves();
  //     console.log(position.component, " Pair Reserves:", reserves);
  //   }
  // }

  const ethPairAddress = await uniswapV2Factory.getPair(WETH, setToken.address);
  const ethPair = UniswapV2Pair__factory.connect(ethPairAddress, signer);

  console.log("WETH Pair deployed to:", ethPairAddress);
  console.log("WETH Pair Reserves:", await ethPair.getReserves());

  await setToken.approve(UNISWAP_V2_ROUTER_ADDRESS, ether(99));

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
  console.log("WETH Pair Reserves:", afterReserves);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
