import dictStyles from './index.css?inline'
import type { Adapter } from '../type'
import { fetchText } from '../fetch'
import { Cache } from '../cache'

const cache = new Cache()

export class LongManDict implements Adapter {
  readonly name = 'longman'
  readonly host = 'https://www.ldoceonline.com'
  readonly apiBase = `${this.host}/search/english/direct/`
  readonly sectionSelector = 'span.dictentry'

  get style() {
    return dictStyles
  }

  async lookup({ word, isPreload }: { word: string; text?: string; isPreload?: boolean }) {
    if (cache.get(word)) return Promise.resolve(cache.get(word)!)
    const doc = await this.fetchDocument(word, isPreload)
    const data = this.parseDocument(doc, word)
    cache.set(word, data)
    return data
  }

  private async fetchDocument(word: string, isPreload?: boolean) {
    const url = this.getPageUrl(word)
    const html = await fetchText(url, isPreload)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc
  }

  getPageUrl(word: string) {
    return `${this.apiBase}?q=${encodeURIComponent(word.replace(/\s+/g, '-'))}`
  }

  private parseDocument(doc: Document, word: string) {
    const root = doc.querySelector('.responsive_cell6')
    if (!root) return ''

    const toRemoveSelectors = [
      'input',
      'label',
      'script',
      'style',
      'noscript',
      'iframe',
      'span[id^="ad_"][class^="am-"]',
      '.asset',
      '.assetlink',
      '.Thesref',
      '.etym', // origin
      '.topslot-container',
      '.contentslot'
    ]

    toRemoveSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove())
    })

    root.querySelectorAll('[data-src-mp3]').forEach(el => {
      el.classList.add('audio_play_button')
    })

    const html = root.innerHTML

    return html
      .replace(/<(script|style|noscript)[^>]*>.*?<\/\1>/g, '')
      .replaceAll(`href="${this.apiBase}`, `data-href="${this.apiBase}`)
      .replaceAll(`href="/search`, `data-href="/search`)
      .replaceAll(`href="/dictionary`, `data-href="${this.host}/dictionary`)
      .replaceAll('<a href="">', '<a href="#">')
      .replaceAll('<a ', '<a target="_blank" ')
      .replaceAll('src="/', `src="${this.host}/`)
      .replaceAll('href="/', `href="${this.host}/`)
  }

  getWordByHref(href: string) {
    const word = href.replace(this.host, '').replace('/dictionary/', '').replace(`/search/direct/?q=`, '')
    return word.toLowerCase()
  }

  cspViolationHandler(e: SecurityPolicyViolationEvent, root: HTMLElement) {
    if (e.violatedDirective === 'img-src') {
      if (e.blockedURI.startsWith(this.host)) {
        root.querySelector(`img[src^="${e.blockedURI}"]`)?.remove()
      }
    }
  }
}
