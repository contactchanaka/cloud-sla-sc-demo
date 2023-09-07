import React, { useState, useEffect } from 'react';
import ParentContractJson from "./contracts/ParentContract.json";
import ChildContractJson from "./contracts/ChildContract.json";
import { ethers } from "ethers";
import './App.css';

const parentContractABI = ParentContractJson.abi;
const childContractABI = ChildContractJson.abi;


const App = () => {
  const [data, setData] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [servers, setServers] = useState([]);
  const [vcpus, setVcpus] = useState([]);
  const [loading, setLoading] = useState(true); // Initialize as true

  const [providerAccount, setProviderAccount] = useState(null);
  const [currentAccount, setCurrentAccount] = useState(null);

  const [contractsAliveData, setContractsAliveData] = useState([]);
  const [contractsTerminatedData, setContractsTerminatedData] = useState([]);



  useEffect(() => {
    const projectApi = process.env.REACT_APP_PROJECT_API;
    const authToken = process.env.REACT_APP_AUTH_TOKEN;

    connectProvideraccount();

    fetch(projectApi, {
      headers: {
        'X-Auth-Token': authToken,
      },
    })
      .then(response => response.json())
      .then(data => setData(data.projects))
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  useEffect(() => {
    console.log("Set Current Account", providerAccount);
    setCurrentAccount(providerAccount);
  }, [providerAccount]);
  
  useEffect(() => {
    if (selectedItem) {
      const serversUrl = process.env.REACT_APP_SERVER_API;
      const authToken = process.env.REACT_APP_AUTH_TOKEN;

      const params = new URLSearchParams();
      params.append('all_tenants', 'T');
      params.append('project_id', selectedItem.id);

      fetch(`${serversUrl}?${params}`, {
        headers: {
          'X-Auth-Token': authToken,
        },
      })
        .then(response => response.json())
        .then(data => {
          if (data.servers) {
            setServers(data.servers);
          } else {
            setServers([]);
          }
        })
        .catch(error => console.error('Error fetching servers data:', error));
    }
  }, [selectedItem]);

  useEffect(() => {
    async function fetchVcpus() {
      const updatedServers = [];

      for (const server of servers) {
        try {
          const serverUrl = `${process.env.REACT_APP_SERVER_API}/${server.id}`;
          const authToken = process.env.REACT_APP_AUTH_TOKEN;

          const serverResponse = await fetch(serverUrl, {
            headers: {
              'X-Auth-Token': authToken,
            },
          });

          const serverData = await serverResponse.json();

          const flavorId = serverData.server.flavor.id;
          const flavorUrl = `${process.env.REACT_APP_FLAVORS_API}/${flavorId}`;

          const flavorResponse = await fetch(flavorUrl, {
            headers: {
              'X-Auth-Token': authToken,
            },
          });

          const flavorData = await flavorResponse.json();
          const vcpus = flavorData.flavor.vcpus;
          const status = serverData.server.status;

          updatedServers.push({
            ...server,
            vcpus,
            status,
          });
          setLoading(false); // Set loading to false when fetch is completed
        } catch (error) {
          console.error('Error fetching flavor or vcpus:', error);
          const vcpus = 0;
          const status = "NONE";
          updatedServers.push({
            ...server,
            vcpus,
            status,
          });
        }
      }
      setVcpus(updatedServers);
      getContractsAlive();
      getContractsTerminated();
      setLoading(false); // Set loading to false when fetch is completed
    }

    if (servers.length > 0) {
      fetchVcpus();
    } else {
      setVcpus([])
      getContractsAlive();
      getContractsTerminated();
      setLoading(false); // Set loading to false when fetch is completed
    }
  }, [servers]);

  const handleSelectChange = event => {
    setLoading(true);
    const selectedItemId = event.target.value;
    const selectedItem = data.find(item => item.id === selectedItemId);
    setSelectedItem(selectedItem);
  };

  const createAgreement = async (customerId, serviceAvailabilityAgreement, allocatedVcpus, monitoringPeriod) => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        const signer = web3Provider.getSigner();
        const parentContractAddress = process.env.REACT_APP_PARENT_CONTRACT_ADDRESS;
        const parentContract = new ethers.Contract(parentContractAddress, parentContractABI, signer);

        //const gasLimit = 3000000; // Set your desired gas limit here
        console.log('currentAccount : ', currentAccount);
        console.log(customerId, 
          parseInt(serviceAvailabilityAgreement), 
          parseInt(allocatedVcpus), 
          parseInt(monitoringPeriod));
        const createTxn = await parentContract.createChildContract(
          customerId, 
          parseInt(serviceAvailabilityAgreement),
          parseInt(allocatedVcpus), 
          parseInt(monitoringPeriod)
        );
  
        console.log("Mining...", createTxn.hash);
  
        await createTxn.wait();
        console.log("Mined -- ", createTxn.hash);
        getContractsAlive();
        getContractsTerminated();       
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const subscribeAgreement = async (childContactAddress) => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        const signer = web3Provider.getSigner();
        const childContractAddress = childContactAddress;
        const childContract = new ethers.Contract(childContractAddress, childContractABI, signer);

        //const gasLimit = 3000000; // Set your desired gas limit here
        await connectCurrentAccount();
        console.log('currentAccount : ', currentAccount);
        console.log(childContactAddress);
        const subscribeTxn = await childContract.subscribe({value : ethers.utils.parseEther("1")});
  
        console.log("Mining...", subscribeTxn.hash);
  
        await subscribeTxn.wait();
        console.log("Mined -- ", subscribeTxn.hash);
        getContractsAlive();
        getContractsTerminated();
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };
  
  const terminateAgreement = async (Index) => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        connectProvideraccount();
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        const signer = web3Provider.getSigner();
        const parentContractAddress = process.env.REACT_APP_PARENT_CONTRACT_ADDRESS;
        const parentContract = new ethers.Contract(parentContractAddress, parentContractABI, signer);

        //const gasLimit = 3000000; // Set your desired gas limit here
        console.log('currentAccount : ', currentAccount);
        const terminateTxn = await parentContract.terminateChildContract(parseInt(Index));
  
        console.log("Mining...", terminateTxn.hash);
  
        await terminateTxn.wait();
        console.log("Mined -- ", terminateTxn.hash);
        getContractsAlive();
        getContractsTerminated();
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const sendMonitoring = async (childContactAddress, data) => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        connectProvideraccount();
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        const signer = web3Provider.getSigner();
        const childContractAddress = childContactAddress;
        const childContract = new ethers.Contract(childContractAddress, childContractABI, signer);

        //const gasLimit = 3000000; // Set your desired gas limit here
        console.log('currentAccount : ', currentAccount);
        console.log('Monitoring data : ', data);
        const monitorTxn = await childContract.addUsageData(parseInt(data));
  
        console.log("Mining...", monitorTxn.hash);
  
        await monitorTxn.wait();
        console.log("Mined -- ", monitorTxn.hash);
        getContractsAlive();
        getContractsTerminated();
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getContractsAlive = async () => {
    try {
      const { ethereum } = window;
      if (!selectedItem) {
        return;
      };
      if (ethereum) {
        await setContractsAliveData([]);
        await connectProvideraccount();
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        const signer = web3Provider.getSigner();
        const parentContractAddress = process.env.REACT_APP_PARENT_CONTRACT_ADDRESS;
        const parentContract = new ethers.Contract(parentContractAddress, parentContractABI, signer);

        let contractsAlive = await parentContract.getAliveContractsByCustomerId(selectedItem.id);
        console.log("Retrieved contractsAlive...", contractsAlive);
        setContractsAliveData(contractsAlive); // Update contractsAliveData state with fetched data
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };
  const getContractsTerminated = async () => {
    try {
      const { ethereum } = window;
      if (!selectedItem) {
        return;
      };
      if (ethereum) {
        await setContractsTerminatedData([]);
        await connectProvideraccount();
        const web3Provider = new ethers.providers.Web3Provider(ethereum);
        const signer = web3Provider.getSigner();
        const parentContractAddress = process.env.REACT_APP_PARENT_CONTRACT_ADDRESS;
        const parentContract = new ethers.Contract(parentContractAddress, parentContractABI, signer);

        let contractsTerminated = await parentContract.getTerminatedContractsByCustomerId(selectedItem.id);
        console.log("Retrieved contractsTerminated...", contractsTerminated);
        setContractsTerminatedData(contractsTerminated); // Update contractsTerminatedData state with fetched data
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };
  
  const connectProvideraccount = async () => {
    try {
      const { ethereum } = window;
 
      if (!ethereum) {
        console.log("Make sure you have metamask!");
        return;
      } else {
        console.log("We have the ethereum object", ethereum);
      }
      // Check if we're authorized to access the user's wallet
      const accounts = await ethereum.request({ method: "eth_accounts" }); 
      console.log('accounts',accounts);
      if (accounts.length !== 0) {
        if (accounts[0] !== providerAccount){
          const isDisconnected = await ethereum.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }],
          });
      
          if (isDisconnected) {
            const accounts = await ethereum.request({ method: "eth_requestAccounts" });
            console.log("Provider Wallet Connected", accounts[0]);
            setProviderAccount(accounts[0]);
          } else {
            console.log("Could not connect wallet");
          }
      } else {
        console.log("Provider Wallet Already Connected", accounts[0]);
        setCurrentAccount(accounts[0]);
      }}
      else {
        console.log("No authorized account found");
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        console.log("Provider Wallet Connected", accounts[0]);
        setProviderAccount(accounts[0]);
      }
    } catch (error) {
      console.log(error);
    }
  };
  const connectCurrentAccount = async () => {
    try {
      const { ethereum } = window;
  
      if (!ethereum) {
        console.log("Make sure you have MetaMask!");
        return;
      }
  
      const isDisconnected = await ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
  
      if (isDisconnected) {
        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        console.log("Current Wallet Connected", accounts[0]);
        setCurrentAccount(accounts[0]);
      } else {
        console.log("Could not connect wallet");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleCreateSLA = () => {
    if (!selectedItem) {
      alert("Please select an item first.");
      return;
    }

    const percentage = prompt("Enter SLA Availability (%)", "");
    const parsedPercentage = parseInt(percentage);

    if (!isNaN(parsedPercentage) && parsedPercentage >= 0 && parsedPercentage <= 100) {
      const { id, description } = selectedItem;
      const allocatedVCPUs = vcpus.reduce((total, server) => total + (server.vcpus || 0), 0);
      const monitoringPeriod = 10;
      createAgreement(id, parsedPercentage, allocatedVCPUs, monitoringPeriod);
      alert(
        `Selected Item: ID - ${id}, Description - ${description}\nAllocated vCPUs: ${allocatedVCPUs}\nSLA Availability: ${parsedPercentage.toFixed(2)}%`
      );
    } else {
      alert("Please enter a valid percentage between 0 and 100.");
    }
  };
  return (
    <div className="App">
      <h1>Cloud SLA</h1>
      <table className="select-table">
            <thead>
              <tr>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Client:</td>
                <td>
                <select onChange={handleSelectChange}>
                  <option value="">Select a client</option>
                  {data.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                </td>
              </tr>
            </tbody>
        </table>        
      {selectedItem && (
        <div>
          <h1>Cloud Performance (vCPUs)</h1>
          <table className="cpu-table">
            <thead>
              <tr>
                <th>Allocated vCPUs</th>
                <th>Available vCPUs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{vcpus.reduce((total, server) => total + (server.vcpus || 0), 0)}</td>
                <td>
                  {vcpus
                    .filter(server => server.status === "ACTIVE")
                    .reduce((total, server) => total + (server.vcpus || 0), 0)}
                </td>
                <td>
                  <span
                      className={`status-span ${vcpus.reduce((total, server) => total + (server.vcpus || 0), 0) >
                          vcpus
                            .filter(server => server.status === "ACTIVE")
                            .reduce((total, server) => total + (server.vcpus || 0), 0)
                          ? "status-red"
                          : "status-green"}`}
                  >
                    {vcpus.reduce((total, server) => total + (server.vcpus || 0), 0) >
                    vcpus
                      .filter(server => server.status === "ACTIVE")
                      .reduce((total, server) => total + (server.vcpus || 0), 0)
                      ? "Partially Available"
                    : "Fully Available"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          {contractsAliveData.length == 0 ? (
          <button onClick={handleCreateSLA} disabled={loading}>
            Create SLA
          </button>) : null }
          <div>
          <h1>ACTIVE AGREEMENT</h1>
          {contractsAliveData.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Contract</th>
                <th>Created</th>
                <th>Subscription (ETH)</th>
                <th>Availability</th>
                <th>Moniter</th>
                <th>Terminate</th>
              </tr>
            </thead>
            <tbody>
            {contractsAliveData.map((contract, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{contract.childContract}</td>
                <td>{new Date(Number(contract.createdDateTime) * 1000).toLocaleString()}</td>
                {contract.subscribed  ? (
                <td>{ethers.utils.formatUnits(contract.subscription.toString(), "ether")} ETH</td>
                 ) : (
                <td>{
                  <button disabled={loading} onClick={() => subscribeAgreement(contract.childContract)}>
                Subscribe (1 ETH)
                </button>}
                </td>)}
                <td>{parseFloat(contract.serviceAvailabilityAgreement).toFixed(2)+"%"}</td>
                {contract.subscribed  ? (
                <td>
                  <button onClick={() => 
                      sendMonitoring(
                        contract.childContract,
                        vcpus
                          .filter(server => server.status === "ACTIVE")
                          .reduce((total, server) => total + (server.vcpus || 0), 0)
                      )}>
                    Send Monitoring
                  </button>
                </td>
                 ) : (
                <td> disabled
                </td>)}
                {contract.subscribed  ? (
                <td>
                  <button onClick={() => terminateAgreement(contract.Id)}>
                    Terminate
                  </button>
                </td>
                 ) : (
                <td> disabled
                </td>)}
              </tr>
            ))}
            </tbody>
          </table> ) : (
            <p>No Alive contracts available.</p>
          )}
          </div>
          <div>
          <h1>AGREEMENT HISTORY</h1>
          {contractsTerminatedData.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Id</th>
                <th>Contract</th>
                <th>Created</th>
                <th>Terminated</th>
                <th>Availability</th>
                {/*<th>Completed</th>
                <th>Subscribed</th>*/}
                <th>Subscription</th>
                <th>Compensation</th>
              </tr>
            </thead>
            <tbody>
            {contractsTerminatedData.map((contract, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{contract.childContract}</td>
                <td>{new Date(Number(contract.createdDateTime) * 1000).toLocaleString()}</td>
                <td>{new Date(Number(contract.terminatedDateTime) * 1000).toLocaleString()}</td>
                <td>{parseFloat(contract.serviceAvailabilityAgreement).toFixed(2)+"%"}</td>
                {/*<td>{contract.completed ? "True" : "False"}</td>
                <td>{contract.subscribed ? "True" : "False"}</td>*/}
                <td>{ethers.utils.formatUnits(contract.subscription.toString(), "ether")} ETH</td>
                <td>{ethers.utils.formatUnits(contract.compensation.toString(), "ether")} ETH</td>
              </tr>
            ))}
            </tbody>
          </table> ) : (
            <p>No Terminated contracts available.</p>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
