import React, { useEffect, useState } from 'react';
import { GenericAccountId, bool as Bool } from '@polkadot/types';
import { Tuple } from '@polkadot/types/codec';
import { useMyAccount } from './MyAccountContext';
import TxButton from './TxButton';
import { isMobile } from 'react-device-detect';
import { useSidebarCollapsed } from './SideBarCollapsedContext';
import { registry } from '@polkadot/react-api';
import BN from 'bn.js';
import { Button$Sizes } from '@polkadot/react-components/Button/types';
import { useSubsocialApi } from './SubsocialApiContext';

type FollowBlogButtonProps = {
  blogId: BN,
  size?: Button$Sizes
};

export function FollowBlogButton (props: FollowBlogButtonProps) {
  const { blogId, size = isMobile ? 'tiny' : 'small' } = props;
  const { state: { address: myAddress } } = useMyAccount();
  const { reloadFollowed } = useSidebarCollapsed();

  const dataForQuery = new Tuple(registry, [ 'AccountId', 'u64' ], [ new GenericAccountId(registry, myAddress), blogId ]);

  const { state: { substrate } } = useSubsocialApi()
  const [ isFollow, setIsFollow ] = useState(false);

  const TxSuccess = () => {
    reloadFollowed();
    setIsFollow(!isFollow);
  };

  useEffect(() => {
    let isSubscribe = true;
    const load = async () => {
      const _isFollow = await (substrate.socialQuery().blogFollowedByAccount(dataForQuery)) as Bool;
      isSubscribe && setIsFollow(_isFollow.valueOf());
    };
    load().catch(err => console.log(err));

    return () => { isSubscribe = false; };
  });

  const buildTxParams = () => {
    return [ blogId ];
  };

  return <TxButton
    size = {size}
    isBasic={isFollow}
    label={isFollow
      ? 'Unfollow'
      : 'Follow'
    }
    params={buildTxParams()}
    tx={isFollow
      ? `social.unfollowBlog`
      : `social.followBlog`}
    onSuccess={TxSuccess}
  />;
}

export default FollowBlogButton;
