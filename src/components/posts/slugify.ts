import { PostContent } from '@subsocial/types'
import { nonEmptyStr } from '@subsocial/utils'
import slugify from '@sindresorhus/slugify'
import BN from 'bn.js'
import { summarize } from 'src/utils'

const MAX_SLUG_LENGTH = 60
const SLUG_SEPARATOR = '-'

export type HasTitleOrBody = Pick<PostContent, 'body' | 'title'>

export const createPostSlug = (postId: BN, content?: HasTitleOrBody) => {
  let slug = postId.toString()

  if (content) {
    const { title, body } = content
    const titleOrBody = nonEmptyStr(title) ? title : body
    const summary = summarize(titleOrBody, { limit: MAX_SLUG_LENGTH, omission: '' })
    const slugifiedSummary = slugify(summary, { separator: SLUG_SEPARATOR })
    
    if (nonEmptyStr(slugifiedSummary)) {
      slug = slugifiedSummary + '-' + slug
    }
  }

  return slug
}

export const getPostIdFromSlug = (slug: string) => {
  try {
    const postId = slug.split(SLUG_SEPARATOR).pop()

    if (!postId) return undefined

    return new BN(postId)
  } catch {
    return undefined
  }
}
