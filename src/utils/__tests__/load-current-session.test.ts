import jose from 'jose';
import Cookies from 'cookies';

import '../../__tests__/shopify-global';
import {config, setConfig} from '../../config';
import * as ShopifyErrors from '../../error';
import {Session} from '../../auth/session';
import {JwtPayload} from '../decode-session-token';
import loadCurrentSession from '../load-current-session';
import {ShopifyOAuth} from '../../auth/oauth/oauth';

jest.mock('cookies');

describe('loadCurrentSession', () => {
  let jwtPayload: JwtPayload;

  beforeEach(() => {
    jwtPayload = {
      iss: 'https://test-shop.myshopify.io/admin',
      dest: 'https://test-shop.myshopify.io',
      aud: config.apiKey,
      sub: '1',
      exp: Date.now() / 1000 + 3600,
      nbf: 1234,
      iat: 1234,
      jti: '4321',
      sid: 'abc123',
    };
  });

  it('gets the current session from cookies for non-embedded apps', async () => {
    config.isEmbeddedApp = false;
    setConfig(config);

    const req = {} as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    const cookieId = '1234-this-is-a-cookie-session-id';

    const session = new Session(
      cookieId,
      'test-shop.myshopify.io',
      'state',
      true,
    );
    await expect(config.sessionStorage.storeSession(session)).resolves.toEqual(
      true,
    );

    Cookies.prototype.get.mockImplementation(() => cookieId);

    await expect(loadCurrentSession(req, res)).resolves.toEqual(session);
  });

  it('loads nothing if there is no session for non-embedded apps', async () => {
    config.isEmbeddedApp = false;
    setConfig(config);

    const req = {} as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    Cookies.prototype.get.mockImplementation(() => null);

    await expect(loadCurrentSession(req, res)).resolves.toBeUndefined();
  });

  it('gets the current session from JWT token for embedded apps', async () => {
    config.isEmbeddedApp = true;
    setConfig(config);

    const token = jwt.sign(jwtPayload, config.apiSecretKey, {
      algorithm: 'HS256',
    });
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    const session = new Session(
      `test-shop.myshopify.io_${jwtPayload.sub}`,
      'test-shop.myshopify.io',
      'state',
      true,
    );
    await expect(config.sessionStorage.storeSession(session)).resolves.toEqual(
      true,
    );

    await expect(loadCurrentSession(req, res)).resolves.toEqual(session);
  });

  it('loads nothing if no authorization header is present', async () => {
    config.isEmbeddedApp = true;
    setConfig(config);

    const req = {headers: {}} as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    await expect(loadCurrentSession(req, res)).resolves.toBeUndefined();
  });

  it('loads nothing if there is no session for embedded apps', async () => {
    config.isEmbeddedApp = true;
    setConfig(config);

    const token = jwt.sign(jwtPayload, config.apiSecretKey, {
      algorithm: 'HS256',
    });
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    await expect(loadCurrentSession(req, res)).resolves.toBeUndefined();
  });

  it('fails if authorization header is missing or is not a Bearer token', async () => {
    config.isEmbeddedApp = true;
    setConfig(config);

    const req = {
      headers: {
        authorization: 'Not a Bearer token!',
      },
    } as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    await expect(() => loadCurrentSession(req, res)).rejects.toBeInstanceOf(
      ShopifyErrors.MissingJwtTokenError,
    );
  });

  it('falls back to the cookie session for embedded apps', async () => {
    config.isEmbeddedApp = true;
    setConfig(config);

    const req = {
      headers: {
        authorization: '',
      },
    } as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    const cookieId = '1234-this-is-a-cookie-session-id';

    const session = new Session(
      cookieId,
      'test-shop.myshopify.io',
      'state',
      true,
    );
    await expect(config.sessionStorage.storeSession(session)).resolves.toEqual(
      true,
    );

    Cookies.prototype.get.mockImplementation(() => cookieId);

    await expect(loadCurrentSession(req, res)).resolves.toEqual(session);
  });

  it('loads offline sessions from cookies', async () => {
    config.isEmbeddedApp = false;
    setConfig(config);

    const req = {} as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    const cookieId = ShopifyOAuth.getOfflineSessionId('test-shop.myshopify.io');

    const session = new Session(
      cookieId,
      'test-shop.myshopify.io',
      'state',
      false,
    );
    await expect(config.sessionStorage.storeSession(session)).resolves.toEqual(
      true,
    );

    Cookies.prototype.get.mockImplementation(() => cookieId);

    await expect(loadCurrentSession(req, res, false)).resolves.toEqual(session);
  });

  it('loads offline sessions from JWT token', async () => {
    config.isEmbeddedApp = true;
    setConfig(config);

    const token = jwt.sign(jwtPayload, config.apiSecretKey, {
      algorithm: 'HS256',
    });
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as http.IncomingMessage;
    const res = {} as http.ServerResponse;

    const session = new Session(
      ShopifyOAuth.getOfflineSessionId('test-shop.myshopify.io'),
      'test-shop.myshopify.io',
      'state',
      false,
    );
    await expect(config.sessionStorage.storeSession(session)).resolves.toEqual(
      true,
    );

    await expect(loadCurrentSession(req, res, false)).resolves.toEqual(session);
  });
});
