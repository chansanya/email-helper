declare module 'juice' {
  interface JuiceOptions {
    applyAttributesTableElements?: boolean
    applyHeightAttributes?: boolean
    applyStyleTags?: boolean
    applyWidthAttributes?: boolean
    extraCss?: string
    insertPreservedExtraCss?: boolean
    inlinePseudoElements?: boolean
    preserveFontFaces?: boolean
    preserveImportant?: boolean
    preserveMediaQueries?: boolean
    preserveKeyFrames?: boolean
    preservePseudos?: boolean
    removeStyleTags?: boolean
    webResources?: Record<string, any>
  }

  function juice(html: string, options?: JuiceOptions): string
  namespace juice {
    function inlineContent(html: string, css: string, options?: JuiceOptions): string
  }
  export default juice
}
