import styles from './NewPostButtonInTopMenu.module.sass'

import { PlusOutlined } from '@ant-design/icons'
import AccountId from '@polkadot/types/generic/AccountId'
import { newLogger } from '@subsocial/utils'
import React, { useState } from 'react'
import { Button, Modal } from 'antd'
import { useMyAddress } from '../auth/MyAccountContext'
import useSubsocialEffect from '../api/useSubsocialEffect'
import { SpaceData } from '@subsocial/types'
import { findSpaceIdsThatCanSuggestIfSudo } from 'src/utils'
import { ViewSpace } from '../spaces/ViewSpace'
import { createNewPostLinkProps, CreateSpaceButton } from '../spaces/helpers'
import Link from 'next/link'
import { Loading } from '../utils'
import { NoData } from '../utils/EmptyList'
import { goToNewPostPage } from '../urls/goToPage'

const log = newLogger('New Post Button In Top Menu')

export const NewPostButtonInTopMenu = () => {
  const myAddress = useMyAddress()
  const [ open, setOpen ] = useState<boolean>(false)
  const [ sudo, setSudo ] = useState<AccountId>()
  const [ spacesData, setSpacesData ] = useState<SpaceData[]>()

  // TODO fix copy-paste, see OnlySudo
  useSubsocialEffect(({ substrate }) => {
    // if (!open) return

    const load = async () => {
      const api = await substrate.api
      const sudo = await api.query.sudo.key()
      setSudo(sudo)
    }

    load()
  }, [ sudo?.toString() ])

  // TODO fix copy-paste, see AccountSpaces
  useSubsocialEffect(({ subsocial, substrate }) => {
    if (/* !open || */ !sudo || !myAddress) return

    const loadSpaces = async () => {
      const mySpaceIds = await substrate.spaceIdsByOwner(myAddress)
      const withoutReservedSpaceIds = findSpaceIdsThatCanSuggestIfSudo(sudo, myAddress, mySpaceIds)
      const spacesData = await subsocial.findPublicSpaces(withoutReservedSpaceIds)
      setSpacesData(spacesData)
    }

    loadSpaces().catch((err) =>
      log.error('Failed to load spaces by account', myAddress, err)
    )
  }, [ sudo?.toString(), myAddress?.toString() ])

  console.table({
    sudo: sudo?.toString(),
    myAddress: myAddress?.toString()
  })

  // TODO show "Create Space" in top menu if user has not spaces
  // or at least don't show "New Post" button if a user has no spaces

  const closeModal = () => setOpen(false)

  /** Go to new post form or show the space selector modal. */
  const onNewPostClick = () => {
    if (spacesData && spacesData.length === 1) {
      // Redirect to the post edit form if a user has only one space
      closeModal()
      goToNewPostPage(spacesData[0].struct)
    } else {
      // Show space selector modal
      setOpen(true)
    }
  }

  const ListOfSpaces = () => {
    if (!spacesData) {
      return <Loading label='Loading your spaces...' />
    }
    
    if (!spacesData.length) {
      return (
        <NoData description={'You have no spaces'}>
          <CreateSpaceButton />
        </NoData>
      )
    }

    return <>{spacesData.map(s =>
      <div key={s.struct.id.toString()} className={styles.DfSpacePreview}>
        <Link {...createNewPostLinkProps(s.struct)}>
          <ViewSpace onClick={closeModal} spaceData={s} miniPreview withFollowButton={false} />
        </Link>
      </div>
    )}</>
  }

  return <>
    <Button icon={<PlusOutlined />} onClick={onNewPostClick}>New post</Button>
    <Modal
      onCancel={closeModal}
      visible={open}
      width={600}
      title={'Choose a space for a new post'}
      footer={<Button onClick={closeModal}>Cancel</Button>}
    >
      <ListOfSpaces />
    </Modal>
  </>
}