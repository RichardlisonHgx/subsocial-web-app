import { EditOutlined, StarOutlined, UserOutlined } from '@ant-design/icons'
import { Menu } from 'antd'
import React, { useState } from 'react'
import { useMyAccount } from '../auth/MyAccountContext'
import { AccountFollowersModal, AccountFollowingModal } from '../profiles/AccountsListModal'
import { EditProfileLink } from '../profiles/address-views/utils'
import { Pluralize } from '../utils/Plularize'
import { useMyAccountDrawer } from './MyAccountMenu'

export const ActionMenu = () => {
  const { state: { account, address }} = useMyAccount()
  const [ followersOpen, setFollowersOpen ] = useState(false)
  const [ followingOpen, setFollowingOpen ] = useState(false)
  const { close } = useMyAccountDrawer()

  if (!account || !address) return null

  const { struct } = account

  const followers = struct ? struct.followers_count.toString() : '0'
  const following = struct ? struct.following_accounts_count.toString() : '0'

  const openFollowersModal = () => {
    if (!followers) return

    setFollowersOpen(true)
  }

  const openFollowingModal = () => {
    if (!following) return

    setFollowingOpen(true)
  }

  return <>
  <Menu className='FontNormal'>
    <Menu.Item key="following" onClick={openFollowingModal} icon={<StarOutlined />}>
      {`My followings (${following})`}
    </Menu.Item>
    <Menu.Item key="follower" onClick={openFollowersModal} icon={<UserOutlined />}>
      {`My followers (${followers})`}
    </Menu.Item>
    <Menu.Item key="edit" icon={<EditOutlined />}>
      <EditProfileLink address={address} onClick={close} />
    </Menu.Item>
  </Menu>
  {followersOpen && <AccountFollowersModal
    id={address}
    followersCount={followers}
    open={followersOpen}
    close={() => setFollowersOpen(false)}
    title={<Pluralize count={followers} singularText='Follower' />}
  />}
  {followingOpen && <AccountFollowingModal
    id={address}
    followingCount={following}
    open={followingOpen}
    close={() => setFollowingOpen(false)}
    title={<Pluralize count={following} singularText='Following' />}
  />}
  </>
}