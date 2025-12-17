import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const OttoGasStationModule = buildModule(
  "OttoGasStationModule",
  (m) => {
    const owner = m.getParameter("owner");

    const gasStation = m.contract("OttoGasStation", [owner]);

    return { gasStation };
  }
);

export default OttoGasStationModule;
