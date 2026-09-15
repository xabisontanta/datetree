import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
// Unit renderer only; browser/Worker behaviour is verified separately when available.
vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'>) =>
    createElement('img', {
      src: props.src,
      alt: props.alt,
      width: props.width,
      height: props.height,
      className: props.className,
      style: props.style,
    }),
}));
vi.mock('next/link', () => ({
  default: (props: ComponentProps<'a'>) => createElement('a', props),
}));
import { emptyPage, newService, toPublicPage } from '@/features/creators/page-schema';
import { accentTextColor, PublicPageView } from './public-page';
describe('shared profile renderer', () => {
  it('renders creator content as text, not markup', () => {
    const d = emptyPage();
    d.profile.displayName = '<script>alert(1)</script>';
    d.profile.username = 'coach';
    d.services = [newService('enquiry', 'Project enquiry')];
    d.services[0]!.privateDetails = 'PRIVATE LOCATION';
    const html = renderToStaticMarkup(
      createElement(PublicPageView, { page: toPublicPage(d), preview: true }),
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('PRIVATE LOCATION');
    expect(html).toContain('Project enquiry');
    expect(html).toContain('disabled');
  });
  it('uses contrasting text for both dark and light accent colours', () => {
    expect(accentTextColor('#000000')).toBe('#ffffff');
    expect(accentTextColor('#ffffff')).toBe('#000000');
    expect(accentTextColor('#176953')).toBe('#ffffff');
  });
});
