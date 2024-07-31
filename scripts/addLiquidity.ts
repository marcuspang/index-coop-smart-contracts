import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Percent, Token, WETH9 } from "@uniswap/sdk-core";
import {
  FeeAmount,
  NonfungiblePositionManager,
  Pool,
  Position,
  computePoolAddress,
  encodeSqrtRatioX96,
  nearestUsableTick,
  type MintOptions,
} from "@uniswap/v3-sdk";
import type { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  ERC20__factory,
  SetToken__factory,
  UniswapV2Factory__factory,
  UniswapV2Pair__factory,
  UniswapV2Router02__factory,
  UniswapV3Factory__factory,
  UniswapV3Pool__factory,
  WETH9__factory,
  type SetToken,
} from "../typechain";
import { ether } from "../utils/common";

const UNISWAP_V2_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const UNISWAP_V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const UNISWAP_V3_ROUTER_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const UNISWAP_V3_POOL_FACTORY_CONTRACT_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS =
  "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

// Update these addresses
const SET_TOKEN_ADDRESS = "0xeA5a5C9E7074Eda371A1E93171C5bf0659772913";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Deploying with account:", signer.address, "balance:", balance.toString());

  const setToken = SetToken__factory.connect(SET_TOKEN_ADDRESS, signer);

  const amountToAdd = ether(0.01);
  const ethToAdd = ether(1);

  await addLiquidityV2(signer, setToken, amountToAdd, ethToAdd);
  // await addLiquidityV3(signer, setToken, amountToAdd, ethToAdd, false);
}

async function addLiquidityV2(
  signer: SignerWithAddress,
  setToken: SetToken,
  amountToAdd: BigNumber,
  ethToAdd: BigNumber,
) {
  const uniswapV2Factory = UniswapV2Factory__factory.connect(UNISWAP_V2_FACTORY_ADDRESS, signer);
  const uniswapV2Router02 = UniswapV2Router02__factory.connect(UNISWAP_V2_ROUTER_ADDRESS, signer);

  const balance = await ethers.provider.getBalance(signer.address);
  if (balance.lt(ethToAdd)) {
    console.log("Not enough ETH to add liquidity", balance);
    return;
  }
  const tokenBalance = await setToken.balanceOf(signer.address);
  if (tokenBalance.lt(amountToAdd)) {
    console.log("Not enough tokens to add liquidity", tokenBalance);
    return;
  }

  await setToken.approve(UNISWAP_V2_ROUTER_ADDRESS, amountToAdd);
  console.log("Approved amountToAdd:", amountToAdd.toString());

  await uniswapV2Router02.addLiquidityETH(
    setToken.address,
    amountToAdd,
    1,
    1,
    signer.address,
    999999999999999,
    { value: ethToAdd },
  );
  console.log("Added liquidity to WETH pair");

  const WETH = await uniswapV2Router02.WETH();
  const wethPairAddress = await uniswapV2Factory.getPair(WETH, setToken.address);
  const wethPair = UniswapV2Pair__factory.connect(wethPairAddress, signer);
  const afterReserves = await wethPair.getReserves();
  console.log("WETH Pair", wethPairAddress, "Reserves:", afterReserves);
}

async function addLiquidityV3(
  signer: SignerWithAddress,
  setToken: SetToken,
  setTokenAmount: BigNumber,
  ethAmount: BigNumber,
  createPool: boolean = true,
) {
  const uniswapV3Factory = UniswapV3Factory__factory.connect(
    UNISWAP_V3_POOL_FACTORY_CONTRACT_ADDRESS,
    signer,
  );

  const balance = await ethers.provider.getBalance(signer.address);
  if (balance.lt(ethAmount)) {
    console.log("Not enough ETH to add liquidity", balance);
    return;
  }
  const tokenBalance = await setToken.balanceOf(signer.address);
  if (tokenBalance.lt(setTokenAmount)) {
    console.log("Not enough tokens to add liquidity", tokenBalance);
    return;
  }

  const chainId = await signer.getChainId();
  const token0 = new Token(
    chainId,
    setToken.address,
    await setToken.decimals(),
    await setToken.symbol(),
    await setToken.name(),
  );
  const token1 = WETH9[chainId];
  const poolFee = FeeAmount.MEDIUM;
  const sqrtPriceX96 = encodeSqrtRatioX96(ethAmount.toString(), setTokenAmount.toString());
  const poolAddress = computePoolAddress({
    factoryAddress: UNISWAP_V3_POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA: token0,
    tokenB: token1,
    fee: poolFee,
  });

  const weth = WETH9__factory.connect(token1.address, signer);
  await weth.approve(UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, ethAmount);
  console.log(
    "Approved weth amount:",
    ethAmount.toString(),
    "to:",
    UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
  );
  await setToken.approve(UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, setTokenAmount);
  console.log(
    "Approved set token amount:",
    setTokenAmount.toString(),
    "to:",
    UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
  );

  const wethBalance = await weth.balanceOf(signer.address);
  if (wethBalance.lt(ethAmount)) {
    const tx = await weth.deposit({ value: ethAmount.sub(wethBalance) });
    await tx.wait();
    console.log("Swapped ETH for WETH", await weth.balanceOf(signer.address));
  }

  if (createPool) {
    const tx = await uniswapV3Factory.createPool(token0.address, token1.address, poolFee);
    await tx.wait();
    console.log("Created V3 Pool");
  }

  const pool = UniswapV3Pool__factory.connect(poolAddress, signer);
  console.log("V3 Pool Address:", poolAddress);

  if (createPool) {
    const tx = await pool.initialize(sqrtPriceX96.toString());
    await tx.wait();
    console.log("Initialized V3 Pool");
  }

  let [liquidity, slot0] = await Promise.all([pool.liquidity(), pool.slot0()]);
  console.log("Liquidity:", liquidity, "slot0:", slot0);

  const configuredPool = new Pool(
    token0,
    token1,
    poolFee,
    slot0.sqrtPriceX96.toString(),
    liquidity.toString(),
    slot0.tick,
  );
  console.log("Configured pool:", configuredPool);
  const position = Position.fromAmounts({
    pool: configuredPool,
    tickLower:
      nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) -
      configuredPool.tickSpacing * 2,
    tickUpper:
      nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) +
      configuredPool.tickSpacing * 2,
    amount0: setTokenAmount.toString(),
    amount1: ethAmount.toString(),
    useFullPrecision: true,
  });
  console.log("Position:", position);

  const mintOptions: MintOptions = {
    recipient: signer.address,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20,
    slippageTolerance: new Percent(50, 10_000),
  };
  console.log("Mint options:", mintOptions);

  // get calldata for minting a position
  const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, mintOptions);

  // send transaction
  const tx = await signer.sendTransaction({
    to: UNISWAP_V3_NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
    data: calldata,
    value,
  });
  await tx.wait();

  [liquidity, slot0] = await Promise.all([pool.liquidity(), pool.slot0()]);
  console.log("Liquidity:", liquidity, "slot0:", slot0);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
