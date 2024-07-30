import { ethers } from "hardhat";
import { BasicIssuanceModule__factory, ERC20__factory, SetToken__factory } from "../typechain";
import { ether } from "../utils/common";

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

  const positions = await setToken.getPositions();

  // approve collateral tokens to be used for issuance of set token
  for await (const position of positions) {
    const erc20 = ERC20__factory.connect(position.component, signer);
    await erc20.approve(basicIssuanceModule.address, ether(100));
    console.log(position.component, " Balance:", await erc20.balanceOf(signer.address));
  }

  await basicIssuanceModule.issue(SET_TOKEN_ADDRESS, ether(0.1), signer.address);
  const newBalance = await setToken.balanceOf(signer.address);
  console.log("SetToken minted tokens to:", signer.address, "current balance:", newBalance);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
