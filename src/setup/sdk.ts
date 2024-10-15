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
  ProvingParams,
} from '@0xpolygonid/js-sdk';
// import { path } from 'path';
import * as path from 'path';

export interface JsSdk {
  packageMgr: IPackageManager;
}

class ProofServiceVerifyOnly extends ProofService {
  constructor(circuitStorage: FSCircuitStorage, states: EthStateStorage) {
    super(null, null, circuitStorage, states);
  }
}

const getPackageMgr = async (
  circuitData: CircuitData,
  stateVerificationFn: StateVerificationFunc,
): Promise<IPackageManager> => {
  const verificationFn = new VerificationHandlerFunc(stateVerificationFn);
  const mapKey =
    proving.provingMethodGroth16AuthV2Instance.methodAlg.toString();

  if (!circuitData.verificationKey) {
    throw new Error(
      `verification key doesn't exist for ${circuitData.circuitId}`,
    );
  }
  const verificationParamMap: Map<string, VerificationParams> = new Map([
    [
      mapKey,
      {
        key: circuitData.verificationKey,
        verificationFn,
      },
    ],
  ]);

  const mgr: IPackageManager = new PackageManager();
  const paramsMap = new Map<string, ProvingParams>();
  const packer = new ZKPPacker(paramsMap, verificationParamMap);
  mgr.registerPackers([packer]);

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
  ];
  const states = new EthStateStorage(conf);

  const circuitStorage = new FSCircuitStorage({
    dirname: path.join(process.cwd(), 'circuits'),
  });

  const proofService = new ProofServiceVerifyOnly(circuitStorage, states);
  const packageMgr = await getPackageMgr(
    await circuitStorage.loadCircuitData(CircuitId.AuthV2),
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

  return {
    packageMgr,
  };
};
