const main = async () => {
    const [deployer] = await hre.ethers.getSigners();
    const accountBalance = await deployer.getBalance();
   
    console.log("Deploying contracts with account: ", deployer.address);
    console.log("Account balance: ", accountBalance.toString());
   
    const ParentContractFactory = await hre.ethers.getContractFactory("ParentContract");
    const ParentContract = await ParentContractFactory.deploy();
    await ParentContract.deployed();
   
    console.log("Parent Contract Address: ", ParentContract.address);
  };
  
  const runMain = async () => {
    try {
      await main();
      process.exit(0);
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  };
  
  runMain();
  