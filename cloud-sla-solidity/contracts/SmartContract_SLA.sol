// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract ParentContract {
    address public owner;
    struct ChildContractInfo {
        uint256 Id;
        string customerId;
        address childContract;
        uint256 createdDateTime;
        uint256 terminatedDateTime;
        bool terminated;
        bool completed;
        bool subscribed;
        uint compensation;
        uint subscription;
        uint serviceAvailabilityAgreement;
    }

    ChildContractInfo[] public childContracts;

    constructor() {
        owner = msg.sender;
    }
    
    function createChildContract(
        string memory customerId,
        uint8 serviceAvailabilityAgreement,
        uint8 allocatedVcpus,
        uint8 monitoringPeriod
    ) external {
        uint256 Index = uint256(childContracts.length);
        ChildContract child = new ChildContract(
            Index,
            owner,
            serviceAvailabilityAgreement,
            allocatedVcpus,
            monitoringPeriod
        );

        ChildContractInfo memory newChild = ChildContractInfo({
            Id: Index,
            customerId: customerId,
            childContract: address(child),
            createdDateTime: block.timestamp,
            terminatedDateTime: 0,
            terminated: false,
            completed: false,
            subscribed: false,
            compensation: 0,
            subscription: 0,
            serviceAvailabilityAgreement: serviceAvailabilityAgreement
        });

        childContracts.push(newChild);
    }

    function terminateChildContract(uint256 index) external {
        require(index < childContracts.length, "Invalid index");

        ChildContract child = ChildContract(childContracts[index].childContract);
        child.terminate();
    }

    function childCompleted(uint256 index, uint compensation, bool completed) external {
        require(index < childContracts.length, "Invalid index");

        childContracts[index].terminatedDateTime = block.timestamp;
        childContracts[index].terminated = true;
        childContracts[index].completed = completed;
        childContracts[index].compensation = compensation;
    }

    function childSubscribed(uint256 index, uint subscription) external {
        require(index < childContracts.length, "Invalid index");

        childContracts[index].subscription = subscription;
        childContracts[index].subscribed = true;
    }

    function getAliveContractsByCustomerId(string memory _customerId) external view returns (ChildContractInfo[] memory) {
        uint256 aliveCount = 0;

        for (uint256 i = 0; i < childContracts.length; i++) {
            if (!childContracts[i].terminated && compareStrings(childContracts[i].customerId, _customerId)) {
                aliveCount++;
            }
        }

        ChildContractInfo[] memory aliveContracts = new ChildContractInfo[](aliveCount);
        uint256 aliveIndex = 0;

        for (uint256 i = 0; i < childContracts.length; i++) {
            if (!childContracts[i].terminated && compareStrings(childContracts[i].customerId, _customerId)) {
                aliveContracts[aliveIndex] = childContracts[i];
                aliveIndex++;
            }
        }

        return aliveContracts;
    }

    function getTerminatedContractsByCustomerId(string memory _customerId) external view returns (ChildContractInfo[] memory) {
        uint256 terminatedCount = 0;

        for (uint256 i = 0; i < childContracts.length; i++) {
            if (childContracts[i].terminated && compareStrings(childContracts[i].customerId, _customerId)) {
                terminatedCount++;
            }
        }

        ChildContractInfo[] memory terminatedContracts = new ChildContractInfo[](terminatedCount);
        uint256 terminatedIndex = 0;

        for (uint256 i = 0; i < childContracts.length; i++) {
            if (childContracts[i].terminated && compareStrings(childContracts[i].customerId, _customerId)) {
                terminatedContracts[terminatedIndex] = childContracts[i];
                terminatedIndex++;
            }
        }

        return terminatedContracts;
    }

    function compareStrings(string memory a, string memory b) private pure returns (bool) {
    return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
}
}

contract ChildContract {
    address public owner;

    struct ContractState {
        uint256 index;
        address parentContract;
        address providerWallet;
        address customerWallet;
        uint256 subscriptionAmount;
        uint8 serviceAvailabilityAgreement; // 0 to 100 (0% to 100%)
        uint8 allocatedVcpus;
        uint8 monitoringPeriod;
        uint8[] usageData;
    }

    ContractState public contractState;

    constructor(
        uint256 index,
        address parentAddress,
        uint8 _serviceAvailabilityAgreement,
        uint8 _allocatedVcpus,
        uint8 _monitoringPeriod
    ) {
        owner = msg.sender;
        contractState = ContractState({
            index: index,
            parentContract: owner,
            providerWallet: parentAddress,
            customerWallet: address(0),
            subscriptionAmount: 0,
            serviceAvailabilityAgreement: _serviceAvailabilityAgreement,
            allocatedVcpus: _allocatedVcpus,
            monitoringPeriod: _monitoringPeriod,
            usageData: new uint8[](0)
        });
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    modifier onlyParent() {
        require(msg.sender == contractState.providerWallet, "Only parent can call this");
        _;
    }
    
    function terminate() external onlyOwner {
        ParentContract parent = ParentContract(contractState.parentContract);
        parent.childCompleted(contractState.index, address(this).balance, false);
        contractState.customerWallet == address(0);
        selfdestruct(payable(contractState.customerWallet));
    }

    function subscribe() external payable {
        require(contractState.customerWallet == address(0), "Already subscribed");
        //require(msg.value == contractState.subscriptionAmount, "Incorrect payment amount");

        contractState.customerWallet = msg.sender;
        contractState.subscriptionAmount = msg.value;
        // inform parent on subscription
        ParentContract parent = ParentContract(contractState.parentContract);
        parent.childSubscribed(contractState.index, address(this).balance);
    }

    function addUsageData(uint256 data) external onlyParent {
        require(!isContractTerminated(), "Contract is terminated");
        require(contractState.usageData.length < contractState.monitoringPeriod, "Data length exceeded");

        uint256 threshold = contractState.allocatedVcpus * uint256(contractState.serviceAvailabilityAgreement);
        
        if (threshold > data * 100) {
            contractState.usageData.push(0);
        } else {
            contractState.usageData.push(1);
        }
        if (contractState.usageData.length == contractState.monitoringPeriod) {
            transferSubscriptionFee(contractState.usageData);
        }
    }

    function transferSubscriptionFee(uint8[] memory data) private {
        uint256 totalUsage = 0;
        for (uint256 i = 0; i < data.length; i++) {
            totalUsage += data[i];
        }

        uint256 calculatedSubscription = (contractState.subscriptionAmount * totalUsage) / contractState.monitoringPeriod;

        // Transfer the calculated compensated subscription to providerWallet
        payable(contractState.providerWallet).transfer(calculatedSubscription);

        // inform parent on completion
        ParentContract parent = ParentContract(contractState.parentContract);
        parent.childCompleted(contractState.index, address(this).balance, true);
        contractState.customerWallet == address(0);
        // Terminate the contract
        selfdestruct(payable(contractState.customerWallet));
    }

    function isContractTerminated() public view returns (bool) {
        return contractState.customerWallet == address(0);
    }
}
