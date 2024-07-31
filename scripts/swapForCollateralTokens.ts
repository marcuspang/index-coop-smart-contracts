import { ethers } from "hardhat";
import { BasicIssuanceModule__factory, ERC20__factory, SetToken__factory } from "../typechain";
import { ether } from "../utils/common";

// Update these addresses
const BASIC_ISSUANCE_MODULE_ADDRESS = "0xA1c8c28dcc714570EF038496D19Fdac138491f7f";
const SET_TOKEN_ADDRESS = "0x575bE173859d08D0f1CceB7Ea451eA41D4839f8C";

async function main() {
  const [signer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Deploying with account:", signer.address, "balance:", balance.toString());

  const basicIssuanceModule = BasicIssuanceModule__factory.connect(
    BASIC_ISSUANCE_MODULE_ADDRESS,
    signer,
  );
  const setToken = SetToken__factory.connect(SET_TOKEN_ADDRESS, signer);

  const positions = await setToken.getPositions();

  const amountToIssue = ether(0.1);

  // approve collateral tokens to be used for issuance of set token
  for await (const position of positions) {
    const erc20 = ERC20__factory.connect(position.component, signer);
    const erc20Amount = amountToIssue.div(ether(1)).mul(position.unit);
    const currentBalance = await erc20.balanceOf(signer.address);
    if (currentBalance.lt(erc20Amount)) {
      console.log("Not enough balance to approve:", erc20Amount);
      return;
    }
    await erc20.approve(basicIssuanceModule.address, erc20Amount);
    console.log(position.component, " Balance:", await erc20.balanceOf(signer.address));
  }

  await basicIssuanceModule.issue(SET_TOKEN_ADDRESS, amountToIssue, signer.address);
  const newBalance = await setToken.balanceOf(signer.address);
  console.log("SetToken minted tokens to:", signer.address, "current balance:", newBalance);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
