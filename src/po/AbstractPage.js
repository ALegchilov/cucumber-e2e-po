const Element = require("./Element");
const Collection = require("./Collection");

/**
 * @abstract
 * @type {AbstractPage}
 */
class AbstractPage {

    constructor() {
        this.elements = new Map();
    }

    /**
     * Define element on page
     * @param {string} element.alias - alias
     * @param {string|Function} element.selector - selector
     * @param {string} [element.selectorType] - selector type (css, cssContainingText, xpath) (default css)
     * @param {string} [element.text] - text (for cssContainingText selector type)
     * @example
     * class Page extends AbstractPage {
     *   constructor() {
     *     super();
     *     this.defineElement({
     *         alias: "YourElement",
     *         selector: "div > div",
     *         selectorType: "cssContainingText",
     *         text: "some text"});
     *     }
     * }
     */
    defineElement(element) {
        this.elements.set(element.alias, new Element(element));
    }

    /**
     * Define collection on page
     * @param {string} collection.alias - alias
     * @param {string} collection.selector - selector
     * @param {string} [collection.selectorType] - selector type (css, cssContainingText, xpath) (default css)
     * @param {string} [collection.text] - text (for cssContainingText selector type)
     * @example
     * class Page extends AbstractPage {
     *   constructor() {
     *     super();
     *     this.defineCollection({
     *         alias: "YourCollection",
     *         selector: "div > div",
     *         selectorType: "cssContainingText",
     *         text: "some text"});
     *     }
     *   }
     * }
     */
    defineCollection(collection) {
        this.elements.set(collection.alias, new Collection(collection));
    }

    /**
     * Define component on page
     * @param {string} [component.alias] - alias or component
     * @param {Component} component.component - component
     * @example
     * class Page extends AbstractPage {
     *   constructor() {
     *     super();
     *     this.defineComponent({
     *         alias: "YourComponent",
     *         component: new CustomComponent()});
     *     this.defineComponent({
     *         component: new CustomComponent()
     *     });
     *   }
     * }
     */
    defineComponent(component) {
        if (component.alias) {
            this.elements.set(component.alias, component.component);
        } else {
            this.elements.set(component.component.alias, component.component);
        }
    }

    /**
     * Get element by key
     * @param {string} key - key
     * @return {ElementFinder|ElementArrayFinder} - protractor element
     */
    getElement(key) {
        const TOKEN_SPLIT_REGEXP = /\s*>\s*/;
        const tokens = key.split(TOKEN_SPLIT_REGEXP);
        const firstToken = tokens.shift();
        const startNode = new ComponentNode(
            this._getProtractorElement(null, this, firstToken),
            this._getComponent(this, firstToken)
        );
        const protractorElement = tokens.reduce((current, token) => {
            return new ComponentNode(
                this._getProtractorElement(current.element, current.component, token),
                this._getComponent(current.component, token)
            )
        }, startNode);

        return protractorElement.element;
    }

    /**
     * Get protractor single element or collection of elements or element from collection
     * @param {ElementFinder|ElementArrayFinder} currentProtractorElement - current element
     * @param {AbstractPage|Component} currentComponent - current component
     * @param {string} token - token to get new element
     * @return {ElementFinder|ElementArrayFinder} - return new element
     * @private
     */
    _getProtractorElement(currentProtractorElement, currentComponent, token) {
        const parsedToken = new ParsedToken(token);
        if (parsedToken.isElementOfCollection()) {
            return this._getElementOfCollection(currentProtractorElement, currentComponent, parsedToken)
        } else {
            return this._getElementOrCollection(currentProtractorElement, currentComponent, parsedToken)
        }
    }

    /**
     * Get protractor element by index or text
     * @param {ElementFinder|ElementArrayFinder} currentProtractorElement - current element
     * @param {Component} currentComponent - current component
     * @param {ParsedToken} parsedToken - parsed token
     * @return {ElementFinder|ElementArrayFinder} - new protractor element
     * @private
     */
    _getElementOfCollection(currentProtractorElement, currentComponent, parsedToken) {
        const ROOT_ELEMENT_SELECTOR = by.css("html");
        const newComponent = this._getComponent(currentComponent, parsedToken.alias);
        const rootElement = currentProtractorElement ? currentProtractorElement : element(ROOT_ELEMENT_SELECTOR);
        if (newComponent.isCollection) {
            const elementsCollection = rootElement.all(this._getSelector(newComponent));
            if (parsedToken.hasTokenIn()) {
                const locator = elementsCollection.locator();
                if (this._isLocatorTranformable(locator)) {
                    return rootElement.all(this._transformLocatorByText(locator, parsedToken.innerText)).first()
                } else {
                    return elementsCollection
                        .filter(elem => elem.getText().then(text => text.includes(parsedToken.innerText)))
                        .first();
                }
            } else if (parsedToken.hasTokenOf()) {
                return elementsCollection.get(parsedToken.index - 1)
            }
        } else {
            throw new Error(`${parsedToken.alias} is not collection`)
        }
    }

    /**
     * Get protractor element or collection
     * @param {ElementFinder|ElementArrayFinder} currentProtractorElement - current element
     * @param {Component} currentComponent - current component
     * @param {ParsedToken} parsedToken - alias
     * @return {ElementFinder|ElementArrayFinder} - new protractor element
     * @private
     */
    _getElementOrCollection(currentProtractorElement, currentComponent, parsedToken) {
        const ROOT_ELEMENT_SELECTOR = by.css("html");
        const newComponent = this._getComponent(currentComponent, parsedToken.alias);
        const rootElement = currentProtractorElement ? currentProtractorElement : element(ROOT_ELEMENT_SELECTOR);

        if (newComponent.isCollection || rootElement.count) {
            return rootElement.all(this._getSelector(newComponent))
        } else {
            return rootElement.element(this._getSelector(newComponent))
        }
    }

    /**
     * Function for verifying and returning element
     * @param {AbstractPage|Component} currentComponent - current component
     * @param {string} token - token to create new compoenent
     * @returns {Component} - new component
     * @throws {Error}
     * @private
     */
    _getComponent(currentComponent, token) {
        const parsedToken = new ParsedToken(token);
        if (currentComponent.elements.has(parsedToken.alias)) {
            return currentComponent.elements.get(parsedToken.alias)
        } else {
            throw new Error(`There is no such element: '${parsedToken.alias}'`)
        }
    }

    /**
     * Resolve element by location strategy
     * @param {Element|Collection|Component} element - element to get selector
     * @return {WebDriverLocator|ProtractorLocator} - by selector
     * @throws {Error}
     * @private
     */
    _getSelector(element) {
        switch (element.selectorType) {
            case "css": return by.css(element.selector);
            case "xpath": return by.xpath(element.selector);
            case "js": return by.js(element.selector);
            case "cssContainingText": {
                if (element.text) {
                    return by.cssContainingText(element.selector, element.text)
                } else {
                    throw new Error("Text is not defined")
                }
            } break;
            default: throw new Error(`Selector type ${element.selectorType} is not defined`);
        }
    }

    /**
     * Verify if locator hack can be applied
     * @param locator - locator of element
     * @return {boolean}
     * @private
     */
    _isLocatorTranformable(locator) {
        switch (locator.using) {
            case "css selector": return true; break;
            default: return false
        }
    }

    /**
     * Transform locator for text selection
     * @param locator - locator
     * @param text - text
     * @return {ProtractorLocator}
     * @private
     */
    _transformLocatorByText(locator, text) {
        switch (locator.using) {
            case "css selector": return by.cssContainingText(locator.value, text); break;
        }
    }

}

/**
 * Component tree node
 * @type {ComponentNode}
 * @private
 */
class ComponentNode {

    /**
     * Constructor of Component Node
     * @param {ElementFinder|ElementArrayFinder} element
     * @param {AbstractPage|Component} component
     */
    constructor(element, component) {
        this.element = element;
        this.component = component;
    }

}

/**
 * Class representing set of element of token
 * @type {ParsedToken}
 * @private
 */
class ParsedToken {

    /**
     * Define token
     * @param {string} token
     */
    constructor(token) {
        const ELEMENT_OF_COLLECTION_REGEXP = /#([!\$]?.+)\s+(in|of)\s+(.+)/;
        if (ELEMENT_OF_COLLECTION_REGEXP.test(token)) {
            const parsedTokens = token.match(ELEMENT_OF_COLLECTION_REGEXP);
            const value = parsedTokens[1];

            this.index = parsedTokens[2] === "of" ? Number.parseInt(value) : undefined;
            this.innerText = parsedTokens[2] === "in" ? value : undefined;
            this.alias = parsedTokens[3];
        } else {
            this.alias = token;
        }
    }

    /**
     * Check if token is element of collection
     * @return {boolean}
     * @public
     */
    isElementOfCollection() {
        return this.index !== undefined || this.innerText !== undefined
    }

    /**
     * Check if token is of
     * @return {boolean}
     * @public
     */
    hasTokenOf() {
        return this.index !== undefined
    }

    /**
     * Check if token is in
     * @return {boolean}
     * @public
     */
    hasTokenIn(){
        return this.innerText !== undefined
    }

}

module.exports = AbstractPage;