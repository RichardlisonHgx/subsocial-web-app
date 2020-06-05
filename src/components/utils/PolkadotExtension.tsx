import React, { useState, useEffect } from 'react';
import { getAccountFromExtension, isWeb3Injected } from './Api';
import { useMyAccount } from './MyAccountContext';
import { AddressPreviewWithOwner } from '../profiles/address-views';
import { Loading } from '.';
import { Button, Avatar, Divider } from 'antd';

export const ChooseAccountFromExtension = () => {
  const [ accounts, setAccounts ] = useState<string[]>()
  const [ loading, setLoading ] = useState(true)
  const { setAddress, setInjectedAccounts } = useMyAccount()

  useEffect(() => {
    const loadAddress = async () => {
      const account = await getAccountFromExtension(setInjectedAccounts)
      setAccounts(account)
      setLoading(false)
    }

    loadAddress().catch(err => console.error(err))

  }, [ isWeb3Injected ])

  const NoExtension = () => (
    <div>
      <div className='mb-4'>Extension is not found, please download her:</div>
      <Button type='default' href='https://chrome.google.com/webstore/detail/polkadot%7Bjs%7D-extension/mopnmbcafieddcagagdcbnhejhlodfdd?hl=de' target='_blank' >
        <Avatar size={20} src='https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Chrome_icon_%28September_2014%29.svg/1200px-Google_Chrome_icon_%28September_2014%29.svg.png' />
        <span className='ml-2'>Polkadot extension for Chrome</span>
      </Button>
      <Divider>or</Divider>
      <Button type='default' href='https://addons.mozilla.org/ru/firefox/addon/polkadot-js-extension/' target='_blank' >
        <Avatar size={20} src='https://www.mozilla.org/media/protocol/img/logos/firefox/browser/logo-lg-high-res.fbc7ffbb50fd.png' />
        <span className='ml-2'>Polkadot extension for Mozila</span>
      </Button>
    </div>
  )

  const NoAccounts = () => (
    <span>Account is not found, please click on extension</span>
  )

  const SelectAccounts = () => (
    <>
      <h4>Select acount for log in:</h4>
      <div className='text-left DfChooseAccountList'>
        {accounts?.map(item => <div
          key={item.toString()}
          className='DfChooseAccount'
          style={{ cursor: 'pointer' }}
          onClick={() => setAddress(item)}
        >
          <AddressPreviewWithOwner address={item} mini />
        </div>)}
      </div>
    </>
  )

  if (!isWeb3Injected) return <NoExtension />;

  if (loading) return <Loading />

  return accounts?.length ? <SelectAccounts /> : <NoAccounts />
}
