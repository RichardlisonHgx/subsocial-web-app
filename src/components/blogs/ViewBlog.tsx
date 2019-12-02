import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

import { withCalls, withMulti } from '@polkadot/ui-api/with';
import { Option, AccountId } from '@polkadot/types';
import IdentityIcon from '@polkadot/ui-app/IdentityIcon';

import { getJsonFromIpfs } from '../utils/OffchainUtils';
import { nonEmptyStr, queryBlogsToProp, SeoHeads } from '../utils/index';
import { BlogId, Blog, PostId, BlogData } from '../types';
import { MyAccountProps, withMyAccount } from '../utils/MyAccount';
import { ViewPost } from '../posts/ViewPost';
import { BlogFollowersModal } from '../profiles/AccountsListModal';
import { BlogHistoryModal } from '../utils/ListsEditHistory';
import { Dropdown, Segment } from 'semantic-ui-react';
import { FollowBlogButton } from '../utils/FollowButton';
import TxButton from '../utils/TxButton';
import { Loading } from '../utils/utils';
import { MutedSpan } from '../utils/MutedText';
import Router from 'next/router';
import ListData, { NoData } from '../utils/DataList';
import { Tag, Button } from 'antd';
import { DfBgImg } from '../utils/DfBgImg';
import { Pluralize } from '../utils/Plularize';
import AddressMiniDf from '../utils/AddressMiniDf';
import Section from '../utils/Section';

const SUB_SIZE = 2;

type Props = MyAccountProps & {
  preview?: boolean,
  nameOnly?: boolean,
  dropdownPreview?: boolean,
  withLink?: boolean,
  miniPreview?: boolean,
  previewDetails?: boolean,
  withFollowButton?: boolean,
  id: BlogId,
  blogById?: Option<Blog>,
  postIds?: PostId[],
  followers?: AccountId[],
  imageSize?: number
};

function Component (props: Props) {
  const { blogById } = props;

  if (blogById === undefined) return <Loading />;
  else if (blogById.isNone) return <NoData description={<span>Blog not found</span>} />;

  const {
    preview = false,
    nameOnly = false,
    withLink = false,
    miniPreview = false,
    previewDetails = false,
    withFollowButton = false,
    dropdownPreview = false,
    myAddress,
    postIds = [],
    imageSize = 36
  } = props;

  const blog = blogById.unwrap();
  const {
    id,
    score,
    created: { account, time },
    ipfs_hash,
    followers_count
  } = blog;
  const followers = followers_count.toNumber();
  const [content, setContent] = useState({} as BlogData);
  const { desc, name, image } = content;

  const [followersOpen, setFollowersOpen] = useState(false);

  useEffect(() => {
    if (!ipfs_hash) return;
    getJsonFromIpfs<BlogData>(ipfs_hash).then(json => {
      const content = json;
      setContent(content);
    }).catch(err => console.log(err));
  }, [id]);

  const isMyBlog = myAddress && account && myAddress === account.toString();
  const hasImage = image && nonEmptyStr(image);
  const postsCount = postIds ? postIds.length : 0;

  const renderDropDownMenu = () => {

    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);

    return (<Dropdown icon='ellipsis horizontal'>
      <Dropdown.Menu>
        {isMyBlog && <Link href={`/edit-blog?id=${id.toString()}`}><a className='item'>Edit</a></Link>}
        <Dropdown.Item text='View edit history' onClick={() => setOpen(true)} />
        {open && <BlogHistoryModal id={id} open={open} close={close} />}
      </Dropdown.Menu>
    </Dropdown>);
  };

  const NameAsLink = () => <Link href={`/blog?id=${id}`}><a>{name}</a></Link>;

  const renderNameOnly = () => {
    return withLink
      ? <NameAsLink />
      : <span>{name}</span>;
  };

  const renderDropDownPreview = () => (
    <div className={`item ProfileDetails DfPreview ${isMyBlog && 'MyBlog'}`}>
      {hasImage
        ? <DfBgImg className='DfAvatar' size={imageSize} src={image} style={{ border: '1px solid #ddd' }} rounded/>
        : <IdentityIcon className='image' value={account} size={imageSize - SUB_SIZE} />
      }
      <div className='content'>
        <div className='handle'>{name}</div>
      </div>
    </div>
  );

  const renderMiniPreview = () => (
    <div onClick={() => Router.push(`/blog?id=${id}`)} className={`item ProfileDetails ${isMyBlog && 'MyBlog'}`}>
      {hasImage
        ? <DfBgImg className='DfAvatar' size={imageSize} src={image} style={{ border: '1px solid #ddd' }} rounded/>
        : <IdentityIcon className='image' value={account} size={imageSize - SUB_SIZE} />
      }
      <div className='content'>
        <div className='handle'>{name}</div>
      </div>
    </div>
  );

  const renderPreview = () => {
    return <div className={`item ProfileDetails ${isMyBlog && 'MyBlog'}`}>
      <div className='DfBlogBody'>
        {hasImage
          ? <DfBgImg className='DfAvatar' size={imageSize} src={image} rounded/>
          : <IdentityIcon className='image' value={account} size={imageSize - SUB_SIZE} />
        }
        <div className='content'>
          <span className='header'>
            <span><NameAsLink /></span>
            <span>{isMyBlog && <Tag color='green' style={{ marginLeft: '.25rem' }}>My blog</Tag>}</span>
            {!previewDetails && renderDropDownMenu()}
          </span>
          <div className='description'>
            <ReactMarkdown className='DfMd' source={desc} linkTarget='_blank' />
          </div>
          {previewDetails && renderPreviewExtraDetails()}
        </div>
      </div>
      {withFollowButton && <FollowBlogButton blogId={id} />}
    </div>;
  };

  const renderPreviewExtraDetails = () => {
    return <>
      <div className={`DfBlogStats ${isMyBlog && 'MyBlog'}`}>
        <Link href={`/blog?id=${id}`}>
          <a className={'DfStatItem ' + (!postsCount && 'disable')}>
          <Pluralize count={postsCount} singularText='Post'/>
          </a>
        </Link>

        <div onClick={() => setFollowersOpen(true)} className={'DfStatItem DfGreyLink' + (!followers && 'disable')}>
          <Pluralize count={followers} singularText='Follower'/>
        </div>

        <MutedSpan className='DfStatItem'><Pluralize count={score.toNumber()} singularText='Point' /></MutedSpan>

        <MutedSpan>{renderDropDownMenu()}</MutedSpan>

        {followersOpen &&
          <BlogFollowersModal
            id={id}
            title={<Pluralize count={followers} singularText='Follower'/>}
            accountsCount={blog.followers_count.toNumber()}
            open={followersOpen}
            close={() => setFollowersOpen(false)}
          />}
      </div>
    </>;
  };

  if (nameOnly) {
    return renderNameOnly();
  } else if (dropdownPreview) {
    return renderDropDownPreview();
  } else if (miniPreview) {
    return renderMiniPreview();
  } else if (preview || previewDetails) {
    return <Segment>{renderPreview()}</Segment>;
  }

  const renderPostPreviews = () => {
    return <ListData
      title={postsSectionTitle()}
      dataSource={postIds}
      renderItem={(id, index) =>
        <ViewPost key={index} id={id} preview />}
      noDataDesc='No posts yet'
      noDataExt={<Button href={`/new-post?blogId=${id}`}>Create post</Button>}
    />;
  };
  const NewPostButton = () => <Button href={`/new-post?blogId=${id}`} icon='plus' size='small' className='DfGreyButton'>New post</Button>;

  const postsSectionTitle = () => {
    return <div className='DfSection--withButton'>
      <span style={{ marginRight: '1rem' }}>{<Pluralize count={postsCount} singularText='Post'/>}</span>
      {postIds.length ? <NewPostButton /> : null}
    </div>;
  };

  const RenderBlogCreator = () => (
    <AddressMiniDf
      value={account}
      isShort={true}
      isPadded={false}
      size={40}
      extraDetails={<Link href={`/post?id=${id.toString()}`} >
          <a className='DfGreyLink'>
            {time}
          </a>
        </Link>}
    />
  );

  return <Section className='DfContentPage'>
    <SeoHeads title={name} name={name} desc={desc} image={image} />
    <div className='ui massive relaxed middle aligned list FullProfile'>
      {renderPreview()}
    </div>
    <RenderBlogCreator />
    <div className='DfSpacedButtons'>
      <FollowBlogButton blogId={id} />
      <TxButton size='small' isBasic={true} isPrimary={false} onClick={() => setFollowersOpen(true)} isDisabled={followers === 0}><Pluralize count={followers} singularText='Follower'/></TxButton>
    </div>

    {followersOpen && <BlogFollowersModal id={id} accountsCount={blog.followers_count.toNumber()} open={followersOpen} close={() => setFollowersOpen(false)} title={<Pluralize count={followers} singularText='Follower'/>} />}
    {renderPostPreviews()}
  </Section>;
}

export default withMulti(
  Component,
  withMyAccount,
  withCalls<Props>(
    queryBlogsToProp('blogById', 'id'),
    queryBlogsToProp('postIdsByBlogId', { paramName: 'id', propName: 'postIds' })
  )
);
