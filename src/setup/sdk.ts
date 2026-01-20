/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { proving } from '@iden3/js-jwz';
import {
  defaultEthConnectionConfig,
  EthStateStorage,
  EthConnectionConfig,
  CircuitData,
  ProofService,
  StateVerificationFunc,
  VerificationHandlerFunc,
  IPackageManager,
  VerificationParams,
  ZKPPacker,
  PackageManager,
  FSCircuitStorage,
  CircuitId,
  PlainPacker,
  IPacker,
  DiscoveryProtocolHandler,
} from '@0xpolygonid/js-sdk';
// import { path } from 'path';
import * as path from 'path';

export interface JsSdk {
  packageMgr: IPackageManager;
  discoveryProtocolHandler: DiscoveryProtocolHandler;
}

class ProofServiceVerifyOnly extends ProofService {
  constructor(circuitStorage: FSCircuitStorage, states: EthStateStorage) {
    super(null, null, circuitStorage, states);
  }
}

export const getPackageMgr = (
  circuitData: CircuitData[],
  stateVerificationFn: StateVerificationFunc,
): IPackageManager => {
  const verificationFn = new VerificationHandlerFunc(stateVerificationFn);

  const mapKeys = [
    proving.provingMethodGroth16AuthV2Instance.methodAlg.toString(),
    proving.provingMethodGroth16AuthV3Instance.methodAlg.toString(),
    proving.provingMethodGroth16AuthV3_8_32Instance.methodAlg.toString(),
  ];

  const verificationParamMap: Map<string, VerificationParams> = new Map();

  for (const mapKey of mapKeys) {
    const mapKeyCircuitId = mapKey.split(':')[1];
    const circuitDataItem = circuitData.find(
      (c) => c.circuitId === mapKeyCircuitId,
    );
    if (!circuitDataItem) {
      throw new Error(`Circuit data not found for ${mapKeyCircuitId}`);
    }
    if (!circuitDataItem.verificationKey) {
      throw new Error(
        `verification key doesn't exist for ${circuitDataItem.circuitId}`,
      );
    }

    verificationParamMap.set(mapKey, {
      key: circuitDataItem.verificationKey,
      verificationFn,
    });
  }

  const mgr: IPackageManager = new PackageManager();
  const packer = new ZKPPacker(new Map(), verificationParamMap);
  const plainPacker = new PlainPacker();
  mgr.registerPackers([packer, plainPacker]);

  return mgr;
};

export const setupSdk = async ({
  rpcUrl,
  contractAddress,
  env = 'production',
}: {
  rpcUrl: string;
  contractAddress: string;
  env?: string;
}) => {
  const conf: EthConnectionConfig[] = [
    {
      ...defaultEthConnectionConfig,
      url: rpcUrl,
      contractAddress,
      chainId: 21000,
    },
    // register billions networks
    {
      ...defaultEthConnectionConfig,
      url: 'https://rpc-mainnet.billions.network',
      contractAddress: '0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896',
      chainId: 45056,
    },
    {
      ...defaultEthConnectionConfig,
      url: 'http://billions-testnet-rpc.eu-north-2.gateway.fm',
      contractAddress: '0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896',
      chainId: 6913,
    },
  ];
  const states = new EthStateStorage(conf);

  const circuitStorage = new FSCircuitStorage({
    dirname: path.join(process.cwd(), 'circuits'),
  });

  const circuitData = await Promise.all([
    circuitStorage.loadCircuitData(CircuitId.AuthV2),
    circuitStorage.loadCircuitData(CircuitId.AuthV3),
    circuitStorage.loadCircuitData(CircuitId.AuthV3_8_32),
  ]);

  const proofService = new ProofServiceVerifyOnly(circuitStorage, states);
  const packageMgr = getPackageMgr(
    circuitData,
    proofService.verifyState.bind(proofService),
  );
  const packers: IPacker[] = [];
  // You can use PlainTextPacker in development mode
  // to pass plain text messages to the agent endpoint
  // but in production you should use only ZKPPacker or JWSPacker
  if (env === 'development') {
    packers.push(new PlainPacker());
  }
  packageMgr.registerPackers(packers);

  const discoveryProtocolHandler = new DiscoveryProtocolHandler({
    packageManager: packageMgr,
  });
  return {
    packageMgr,
    discoveryProtocolHandler,
  };
};
