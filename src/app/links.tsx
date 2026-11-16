import { useT } from '@/i18n/useT';

export type LinkKey =
  | 'account'
  | 'pricing'
  | 'imprint'
  | 'privacy'
  | 'terms'
  | 'cancel'
  | 'source'
  | 'findCarpenter';

export interface Link {
  key: LinkKey;
  href: string;
}

/** Header, footer and outputs links, injected at build time via `__FD_LINKS__` (plan §3.4 item 4). */
export interface FdLinks {
  header: Link[];
  footer: Link[];
  outputs: Link[];
}

export function fdLinks(): FdLinks {
  return __FD_LINKS__;
}

/** Renders a list of configured links; `{designId}` in an href is replaced when provided. */
export function LinkList({ links, designId }: { links: Link[]; designId?: string }) {
  const { t } = useT();
  return (
    <>
      {links.map((link) => (
        <a key={link.key} href={designId !== undefined ? link.href.replaceAll('{designId}', designId) : link.href}>
          {t(`links.${link.key}`)}
        </a>
      ))}
    </>
  );
}
