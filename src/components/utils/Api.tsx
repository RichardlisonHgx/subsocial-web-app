// Copyright 2017-2020 @polkadot/react-api authors & contributors
// This software may be modified and distributed under the terms
// of the Apache-2.0 license. See the LICENSE file for details.
import { InjectedExtension } from '@polkadot/extension-inject/types';
import { ChainProperties, ChainType } from '@polkadot/types/interfaces';
import { ApiProps, ApiState } from '@subsocial/react-api/types';

import React, { useContext, useEffect, useMemo, useState } from 'react';
import ApiPromise from '@polkadot/api/promise';
import { typesChain, typesSpec } from '@subsocial/apps-config/api';
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp';
import { WsProvider } from '@polkadot/rpc-provider';
import { StatusContext } from '@subsocial/react-components/Status';
import { TokenUnit } from '@subsocial/react-components/InputNumber';
import uiSettings from '@polkadot/ui-settings';
import ApiSigner from '@subsocial/react-signer/ApiSigner';
import { formatBalance, isTestChain } from '@polkadot/util';
import { setSS58Format } from '@polkadot/util-crypto';
import addressDefaults from '@polkadot/util-crypto/address/defaults';
import ApiContext from '@subsocial/react-api/ApiContext';
import registry from '@subsocial/react-api/typeRegistry';
import { InjectedAccountExt } from './types';
export * from '@polkadot/extension-dapp'

const isWindow = typeof window !== 'undefined';

interface Props {
  children: React.ReactNode;
  url?: string;
}

interface ChainData {
  properties: ChainProperties;
  systemChain: string;
  systemChainType: ChainType;
  systemName: string;
  systemVersion: string;
}

export const injectedPromise = new Promise<InjectedExtension[]>((resolve): void => {
  isWindow && window.addEventListener('load', (): void => {
    resolve(web3Enable('polkadot-js/apps'));
  });
});

export const getAccountFromExtension = async (setInjectedAccounts: (data: InjectedAccountExt[]) => void) => {
  console.log('injectedAccounts')

  const injectedAccounts = await injectedPromise
    .then(() => web3Accounts())
    .then((accounts) => accounts.map(({ address, meta }): InjectedAccountExt => ({
      address,
      meta: {
        ...meta,
        name: `${meta.name} (${meta.source === 'polkadot-js' ? 'extension' : meta.source})`
      }
    })))
    .catch((error): InjectedAccountExt[] => {
      console.error('web3Enable', error);

      return [];
    })

  console.log(injectedAccounts)
  setInjectedAccounts(injectedAccounts)
  return injectedAccounts.map(item => item.address)
}

const DEFAULT_DECIMALS = registry.createType('u32', 12);
export const DEFAULT_SS58 = registry.createType('u32', addressDefaults.prefix);
let api: ApiPromise;

export { api };

async function retrieve (api: ApiPromise): Promise<ChainData> {
  const [ properties, systemChain, systemChainType, systemName, systemVersion ] = await Promise.all([
    api.rpc.system.properties(),
    api.rpc.system.chain(),
    api.rpc.system.chainType
      ? api.rpc.system.chainType()
      : Promise.resolve(registry.createType('ChainType', 'Live')),
    api.rpc.system.name(),
    api.rpc.system.version()
    /* injectedPromise
      .then(() => web3Accounts())
      .then((accounts) => accounts.map(({ address, meta }): InjectedAccountExt => ({
        address,
        meta: {
          ...meta,
          name: `${meta.name} (${meta.source === 'polkadot-js' ? 'extension' : meta.source})`
        }
      })))
      .catch((error): InjectedAccountExt[] => {
        console.error('web3Enable', error);

        return [];
      }) */
  ]);

  return {
    properties,
    systemChain: (systemChain || '<unknown>').toString(),
    systemChainType,
    systemName: systemName.toString(),
    systemVersion: systemVersion.toString()
  };
}

async function loadOnReady (api: ApiPromise): Promise<ApiState> {
  const { properties, systemChain, systemChainType, systemName, systemVersion } = await retrieve(api);
  const ss58Format = uiSettings.prefix === -1
    ? properties.ss58Format.unwrapOr(DEFAULT_SS58).toNumber()
    : uiSettings.prefix;
  const tokenSymbol = properties.tokenSymbol.unwrapOr(undefined)?.toString();
  const tokenDecimals = properties.tokenDecimals.unwrapOr(DEFAULT_DECIMALS).toNumber();
  const isDevelopment = systemChainType.isDevelopment || systemChainType.isLocal || isTestChain(systemChain);

  console.log(`chain: ${systemChain} (${systemChainType}), ${JSON.stringify(properties)}`);

  // explicitly override the ss58Format as specified
  registry.setChainProperties(registry.createType('ChainProperties', { ...properties, ss58Format }));

  // FIXME This should be removed (however we have some hanging bits, e.g. vanity)
  setSS58Format(ss58Format);

  // first setup the UI helpers
  formatBalance.setDefaults({
    decimals: tokenDecimals,
    unit: tokenSymbol
  });
  TokenUnit.setAbbr(tokenSymbol);

  const defaultSection = Object.keys(api.tx)[0];
  const defaultMethod = Object.keys(api.tx[defaultSection])[0];
  const apiDefaultTx = api.tx[defaultSection][defaultMethod];
  const apiDefaultTxSudo = (api.tx.system && api.tx.system.setCode) || apiDefaultTx;
  const isSubstrateV2 = !!Object.keys(api.consts).length;

  return {
    apiDefaultTx,
    apiDefaultTxSudo,
    isApiReady: true,
    isDevelopment,
    isSubstrateV2,
    systemChain,
    systemName,
    systemVersion
  };
}

function Api ({ children, url }: Props): React.ReactElement<Props> | null {
  const { queuePayload, queueSetTxStatus } = useContext(StatusContext);
  const [ state, setState ] = useState<ApiState>({ isApiReady: false } as unknown as ApiState);
  const [ isApiConnected, setIsApiConnected ] = useState(false);
  const [ isApiInitialized, setIsApiInitialized ] = useState(false);

  const [ extensions, setExtensions ] = useState<InjectedExtension[] | undefined>();
  const props = useMemo<ApiProps>(
    () => ({ ...state, extensions, api, isApiConnected, isApiInitialized, isWaitingInjected: false }),
    [ isApiConnected, isApiInitialized, state ]
  );

  // initial initialization
  useEffect((): void => {
    const provider = new WsProvider(url);
    const signer = new ApiSigner(queuePayload, queueSetTxStatus);

    api = new ApiPromise({ provider, registry, signer, typesChain, typesSpec });

    api.on('connected', () => setIsApiConnected(true));
    api.on('disconnected', () => setIsApiConnected(false));
    api.on('ready', async (): Promise<void> => {
      try {
        setState(await loadOnReady(api));
      } catch (error) {
        console.error('Unable to load chain', error);
      }
    });

    injectedPromise
      .then(setExtensions)
      .catch((error) => console.error(error));

    setIsApiInitialized(true);
  }, [ false ]);

  if (!props.isApiInitialized) {
    return null;
  }

  return (
    <ApiContext.Provider value={props}>
      {children}
    </ApiContext.Provider>
  );
}

export default React.memo(Api);
