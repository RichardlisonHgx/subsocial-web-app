import React, { useState, useEffect } from 'react';
import { Button } from 'semantic-ui-react';
import { Form, Field, withFormik, FormikProps } from 'formik';
import * as Yup from 'yup';

import { Option } from '@polkadot/types';
import Section from '../utils/Section';
import dynamic from 'next/dynamic';
import { SubmittableResult } from '@polkadot/api';
import { withCalls, withMulti, registry } from '@polkadot/react-api';
import { ipfs } from '../utils/OffchainUtils';
import * as DfForms from '../utils/forms';
import { queryBlogsToProp } from '../utils/index';
import { getNewIdFromEvent, Loading } from '../utils/utils';
import { useMyAccount } from '../utils/MyAccountContext';
import BN from 'bn.js';
import SimpleMDEReact from 'react-simplemde-editor';
import Router, { useRouter } from 'next/router';
import HeadMeta from '../utils/HeadMeta';
import { TxFailedCallback } from '@polkadot/react-components/Status/types';
import { TxCallback } from '../utils/types';
import { Blog } from '@subsocial/types/substrate/interfaces';
import { BlogContent } from '@subsocial/types/offchain';
import { BlogUpdate } from '@subsocial/types/substrate/classes';

const TxButton = dynamic(() => import('../utils/TxButton'), { ssr: false });

// TODO get next settings from Substrate:
const SLUG_REGEX = /^[A-Za-z0-9_-]+$/;

const URL_MAX_LEN = 2000;

const NAME_MIN_LEN = 3;
const NAME_MAX_LEN = 100;

const buildSchema = (p: ValidationProps) => Yup.object().shape({

  slug: Yup.string()
    .required('Slug is required')
    .matches(SLUG_REGEX, 'Slug can have only letters (a-z, A-Z), numbers (0-9), underscores (_) and dashes (-).')
    .min(p.slugMinLen || NAME_MIN_LEN, `Slug is too short. Minimum length is ${p.slugMinLen} chars.`)
    .max(p.slugMaxLen || NAME_MAX_LEN, `Slug is too long. Maximum length is ${p.slugMaxLen} chars.`),

  name: Yup.string()
    .required('Name is required')
    .min(NAME_MIN_LEN, `Name is too short. Minimum length is ${NAME_MIN_LEN} chars.`)
    .max(NAME_MAX_LEN, `Name is too long. Maximum length is ${NAME_MAX_LEN} chars.`),

  image: Yup.string()
    .url('Image must be a valid URL.')
    .max(URL_MAX_LEN, `Image URL is too long. Maximum length is ${URL_MAX_LEN} chars.`),

  desc: Yup.string()
    .max(p.blogMaxLen || URL_MAX_LEN, `Description is too long. Maximum length is ${p.blogMaxLen} chars.`)
});

type ValidationProps = {
  blogMaxLen?: number;
  slugMinLen?: number;
  slugMaxLen?: number;
};

type OuterProps = ValidationProps & {
  id?: BN;
  struct?: Blog;
  json?: BlogContent;
};

type FormValues = BlogContent & {
  slug: string;
};

type FormProps = OuterProps & FormikProps<FormValues>;

const LabelledField = DfForms.LabelledField<FormValues>();

const LabelledText = DfForms.LabelledText<FormValues>();

const InnerForm = (props: FormProps) => {
  const {
    id,
    struct,
    values,
    errors,
    dirty,
    isValid,
    setFieldValue,
    isSubmitting,
    setSubmitting,
    resetForm
  } = props;

  const {
    slug,
    name,
    desc,
    image,
    tags
  } = values;

  const goToView = (id: BN) => {
    Router.push('/blogs/' + id.toString()).catch(console.log);
  };

  const [ ipfsCid, setIpfsCid ] = useState('');

  const onSubmit = (sendTx: () => void) => {
    if (isValid) {
      const json = { name, desc, image, tags };
      ipfs.saveBlog(json).then(cid => {
        cid && setIpfsCid(cid.toString());
        sendTx();
      }).catch(err => new Error(err));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onTxFailed: TxFailedCallback = (txResult: SubmittableResult | null) => {
    ipfs.removeContent(ipfsCid).catch(err => new Error(err));
    setSubmitting(false);
  };

  const onTxSuccess: TxCallback = (txResult: SubmittableResult) => {
    setSubmitting(false);

    const _id = id || getNewIdFromEvent(txResult);
    _id && goToView(_id);
  };

  const buildTxParams = () => {
    if (!isValid) return [];
    if (!struct) {
      return [ slug, ipfsCid ];
    } else {
      // TODO update only dirty values.
      const update = new BlogUpdate({
        writers: new Option(registry, 'Vec<AccountId>', (struct.writers)),
        slug: new Option(registry, 'Text', slug),
        ipfs_hash: new Option(registry, 'Text', ipfsCid)
      });
      return [ struct.id, update ];
    }
  };

  const title = struct ? `Edit blog` : `New blog`;

  return (<>
    <HeadMeta title={title}/>
    <Section className='EditEntityBox' title={title}>
      <Form className='ui form DfForm EditEntityForm'>

        <LabelledText name='name' label='Blog name' placeholder='Name of your blog.' {...props} />

        <LabelledText name='slug' label='URL slug' placeholder={`You can use a-z, 0-9, dashes and underscores.`} style={{ maxWidth: '30rem' }} {...props} />

        <LabelledText name='image' label='Image URL' placeholder={`Should be a valid image Url.`} {...props} />

        <LabelledField name='desc' label='Description' {...props}>
          <Field component={SimpleMDEReact} name='desc' value={desc} onChange={(data: string) => setFieldValue('desc', data)} className={`DfMdEditor ${errors['desc'] && 'error'}`} />
        </LabelledField>

        {/* TODO tags */}

        <LabelledField {...props}>
          <TxButton
            type='submit'
            size='medium'
            label={struct
              ? 'Update blog'
              : 'Create new blog'
            }
            isDisabled={!dirty || isSubmitting}
            params={buildTxParams()}
            tx={struct
              ? 'social.updateBlog'
              : 'social.createBlog'
            }
            onClick={onSubmit}
            onFailed={onTxFailed}
            onSuccess={onTxSuccess}
          />
          <Button
            type='button'
            size='medium'
            disabled={!dirty || isSubmitting}
            onClick={() => resetForm()}
            content='Reset form'
          />
        </LabelledField>
      </Form>
    </Section>
  </>
  );
};

const EditForm = withFormik<OuterProps, FormValues>({

  // Transform outer props into form values
  mapPropsToValues: (props): FormValues => {
    const { struct, json } = props;
    if (struct && json) {
      const slug = struct.slug.toString();
      return {
        slug,
        ...json
      };
    } else {
      return {
        slug: '',
        name: '',
        desc: '',
        image: '',
        tags: []
      };
    }
  },

  validationSchema: (props: OuterProps) => buildSchema({
    blogMaxLen: props.blogMaxLen,
    slugMinLen: props.slugMinLen,
    slugMaxLen: props.slugMaxLen
  }),

  handleSubmit: values => {
    // do submitting things
  }
})(InnerForm);

function withIdFromUrl (Component: React.ComponentType<OuterProps>) {
  return function (props: OuterProps) {
    const router = useRouter();
    const { blogId } = router.query;
    try {
      return <Component id={new BN(blogId as string)}/>;
    } catch (err) {
      return <em>Invalid blog ID: {blogId}</em>;
    }
  };
}

type LoadStructProps = OuterProps & {
  structOpt: Option<Blog>;
};

type StructJson = BlogContent | undefined;

type Struct = Blog | undefined;

function LoadStruct (props: LoadStructProps) {
  const { state: { address: myAddress } } = useMyAccount();
  const { structOpt } = props;
  const [ json, setJson ] = useState(undefined as StructJson);
  const [ struct, setStruct ] = useState(undefined as Struct);
  const [ trigger, setTrigger ] = useState(false);
  const jsonIsNone = json === undefined;

  const toggleTrigger = () => {
    json === undefined && setTrigger(!trigger);
  };

  useEffect(() => {
    if (!myAddress || !structOpt || structOpt.isNone) return toggleTrigger();

    setStruct(structOpt.unwrap());

    if (struct === undefined) return toggleTrigger();

    console.log('Loading blog JSON from IPFS');
    ipfs.findBlog(struct.ipfs_hash).then(json => {
      setJson(json);
    }).catch(err => console.log(err));
  }, [ trigger ]);

  if (!myAddress || !structOpt || jsonIsNone) {
    return <Loading />;
  }

  if (!struct || !struct.created.account.eq(myAddress)) {
    return <em>You have no rights to edit this blog</em>;
  }

  if (structOpt.isNone) {
    return <em>Blog not found...</em>;
  }

  return <EditForm {...props} struct={struct} json={json} />;
}

const commonQueries = [
  queryBlogsToProp('blogMaxLen', { propName: 'blogMaxLen' }),
  queryBlogsToProp('slugMinLen', { propName: 'slugMinLen' }),
  queryBlogsToProp('slugMaxLen', { propName: 'slugMaxLen' })
]

export const NewBlog = withMulti(
  EditForm,
  withCalls<OuterProps>(
    ...commonQueries
  )
  // , withOnlyMembers
);

export const EditBlog = withMulti(
  LoadStruct,
  withIdFromUrl,
  withCalls<OuterProps>(
    queryBlogsToProp('blogById', { paramName: 'id', propName: 'structOpt' }),
    ...commonQueries
  )
);

export default NewBlog;
