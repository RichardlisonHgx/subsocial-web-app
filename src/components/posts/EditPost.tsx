import React, { useState } from 'react'
import { Form, Input, Select } from 'antd'
import { useRouter } from 'next/router'
import BN from 'bn.js'
import { getNewIdFromEvent, equalAddresses, getTxParams } from '../substrate'
import { TxFailedCallback, TxCallback } from 'src/components/substrate/SubstrateTxButton'
import { PostExtension, PostUpdate, OptionId, OptionBool, OptionIpfsContent, IpfsContent } from '@subsocial/types/substrate/classes'
import { IpfsCid, PostId } from '@subsocial/types/substrate/interfaces'
import { PostContent, PostData } from '@subsocial/types'
import { registry } from '@subsocial/types/substrate/registry'
import { newLogger } from '@subsocial/utils'
import { useSubsocialApi } from '../utils/SubsocialApiContext'
import useSubsocialEffect from '../api/useSubsocialEffect'
import { useMyAddress } from '../auth/MyAccountContext'
import { DfForm, DfFormButtons, minLenError, maxLenError } from '../forms'
import { Loading } from '../utils'
import NoData from '../utils/EmptyList'
import { Null } from '@polkadot/types'
import DfMdEditor from '../utils/DfMdEditor'
import SpacegedSectionTitle from '../spaces/SpacedSectionTitle'
import { withLoadSpaceFromUrl, CanHaveSpaceProps } from '../spaces/withLoadSpaceFromUrl'
import { UploadCover } from '../uploader'
import { getNonEmptyPostContent } from '../utils/content'
import messages from 'src/messages'
import { postUrl } from '../urls'
import { PageContent } from '../main/PageWrapper'
import { clearAutoSavedContent } from '../utils/DfMdEditor/client'
import { getPostIdFromSlug } from './slugify'
import { AutoSaveId } from '../utils/DfMdEditor/types'

const log = newLogger('EditPost')

const TITLE_MIN_LEN = 3
const TITLE_MAX_LEN = 100

const BODY_MAX_LEN = 100_000 // ~100k chars

const MAX_TAGS = 10

type Content = PostContent

type FormValues = Partial<Content & {
  spaceId: string
}>

type FieldName = keyof FormValues

const fieldName = (name: FieldName): FieldName => name

type FormProps = CanHaveSpaceProps & {
  post?: PostData
  /** Spaces where you can post. */
  spaceIds?: BN[]
}

function getInitialValues ({ space, post }: FormProps): FormValues {
  if (space && post) {
    const spaceId = space.struct.id.toString()
    return { ...post.content, spaceId }
  }
  return {}
}

const RegularPostExt = new PostExtension({ RegularPost: new Null(registry) })

export function InnerForm (props: FormProps) {
  const { space, post } = props
  const router = useRouter()
  const [ form ] = Form.useForm()
  const { ipfs } = useSubsocialApi()
  const [ IpfsCid, setIpfsCid ] = useState<IpfsCid>()

  if (!space) return <NoData description='Space not found' />

  const spaceId = space.struct.id
  const initialValues = getInitialValues(props)
  const tags = initialValues.tags || []

  // Auto save a post's body only if we are on a "New Post" form.
  const autoSaveId: AutoSaveId | undefined = !post ? 'post' : undefined

  const getFieldValues = (): FormValues => {
    return form.getFieldsValue() as FormValues
  }

  const newTxParams = (cid: IpfsCid) => {
    if (!post) {
      // If creating a new post.
      return [ spaceId, RegularPostExt, new IpfsContent(cid) ]
    } else {
      // If updating the existing post.

      // TODO Update only changed values.

      const update = new PostUpdate({
        // If we provide a new space_id in update, it will move this post to another space.
        space_id: new OptionId(),
        content: new OptionIpfsContent(cid),
        hidden: new OptionBool(false) // TODO has no implementation on UI
      })
      return [ post.struct.id, update ]
    }
  }

  const fieldValuesToContent = (): Content =>
    getNonEmptyPostContent(getFieldValues() as Content)

  const pinToIpfsAndBuildTxParams = () => {

    // TODO pin to IPFS only if JSON changed.

    return getTxParams({
      json: fieldValuesToContent(),
      buildTxParamsCallback: newTxParams,
      setIpfsCid,
      ipfs
    })
  }

  const onFailed: TxFailedCallback = () => {
    IpfsCid && ipfs.removeContent(IpfsCid).catch(err => new Error(err))
  }

  const onSuccess: TxCallback = (txResult) => {
    const id = post?.struct.id || getNewIdFromEvent(txResult)
    clearAutoSavedContent('post')
    id && goToView(id)
  }

  const goToView = (postId: BN) => {
    const content = getFieldValues() as PostContent
    const postData = { struct: { id: postId as PostId }, content }
    router.push('/[spaceId]/[slug]', postUrl(space.struct, postData))
      .catch(err => log.error(`Failed to redirect to a post page. ${err}`))
  }

  const onBodyChanged = (mdText: string) => {
    form.setFieldsValue({ [fieldName('body')]: mdText })
  }

  const onAvatarChanged = (url?: string) => {
    form.setFieldsValue({ [fieldName('image')]: url })
  }

  return <>
    <DfForm form={form} initialValues={initialValues}>
      <Form.Item
        name={fieldName('title')}
        label='Post title'
        hasFeedback
        rules={[
          // { required: true, message: 'Post title is required.' },
          { min: TITLE_MIN_LEN, message: minLenError('Post title', TITLE_MIN_LEN) },
          { max: TITLE_MAX_LEN, message: maxLenError('Post title', TITLE_MAX_LEN) }
        ]}
      >
        <Input placeholder='Optional: A title of your post' />
      </Form.Item>

      <Form.Item
        name={fieldName('image')}
        label='Cover'
        help={messages.imageShouldBeLessThanTwoMB}
      >
        <UploadCover onChange={onAvatarChanged} img={initialValues.image} />
      </Form.Item>

      <Form.Item
        name={fieldName('body')}
        label='Post'
        hasFeedback
        rules={[
          { required: true, message: 'Post body is required.' },
          { max: BODY_MAX_LEN, message: maxLenError('Post body', BODY_MAX_LEN) }
        ]}
      >
        <DfMdEditor autoSaveId={autoSaveId} onChange={onBodyChanged} />
      </Form.Item>

      <Form.Item
        name={fieldName('tags')}
        label='Tags'
        hasFeedback
        rules={[
          { type: 'array', max: MAX_TAGS, message: `You can use up to ${MAX_TAGS} tags.` }
        ]}
      >
        <Select
          mode='tags'
          placeholder="Press 'Enter' or 'Tab' key to add tags"
        >
          {tags.map((tag, i) =>
            <Select.Option key={i} value={tag}>{tag}</Select.Option>
          )}
        </Select>
      </Form.Item>

      <Form.Item
        name={fieldName('canonical')}
        label='Original URL'
        help='This is the orginal URL of the place you first posted about this on another social media platform (i.e. Medium, Reddit, Twitter, etc.)'
        hasFeedback
        rules={[
          { type: 'url', message: 'Should be a valid URL.' }
        ]}
      >
        <Input type='url' placeholder='URL of the original post' />
      </Form.Item>

      {/* // TODO impl Move post to another space. See component SelectSpacePreview */}

      <DfFormButtons
        form={form}
        txProps={{
          label: post
            ? 'Update post'
            : 'Create post',
          tx: post
            ? 'posts.updatePost'
            : 'posts.createPost',
          params: pinToIpfsAndBuildTxParams,
          onSuccess,
          onFailed
        }}
      />
    </DfForm>
  </>
}

export function FormInSection (props: FormProps) {
  const { space, post } = props

  const pageTitle = post ? 'Edit post' : 'New post'

  const sectionTitle =
    <SpacegedSectionTitle space={space} subtitle={pageTitle} />

  return <PageContent
      className='EditEntityBox'
      meta={{ title: pageTitle }}
      title={sectionTitle}
    >
    <InnerForm {...props} />
  </PageContent>
}

function LoadPostThenEdit (props: FormProps) {
  const { slug } = useRouter().query
  const postId = getPostIdFromSlug(slug as string)
  const myAddress = useMyAddress()
  const [ isLoaded, setIsLoaded ] = useState(false)
  const [ post, setPost ] = useState<PostData>()

  useSubsocialEffect(({ subsocial }) => {
    if (!postId) return

    const load = async () => {
      setIsLoaded(false)
      setPost(await subsocial.findPost({ id: postId }))
      setIsLoaded(true)
    }

    load()
  }, [ postId?.toString() ])

  if (!postId) return <NoData description='Post id not found in URL' />

  if (!isLoaded) return <Loading label='Loading the post...' />

  if (!post) return <NoData description='Post not found' />

  const postOwner = post.struct?.owner
  const isOwner = equalAddresses(myAddress, postOwner)
  if (!isOwner) return <NoData description='You do not have permission to edit this post' />

  return <FormInSection {...props} post={post} />
}

export const EditPost = withLoadSpaceFromUrl(LoadPostThenEdit)

export const NewPost = withLoadSpaceFromUrl(FormInSection)

export default NewPost
