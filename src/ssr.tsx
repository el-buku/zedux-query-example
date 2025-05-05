import { getRouterManifest } from "@tanstack/react-start/router-manifest";
/// <reference types="vinxi/types/server" />
import { StartServer, createStartHandler } from "@tanstack/react-start/server";

import { PassThrough } from "node:stream";
import { isbot } from "isbot";
import ReactDOMServer from "react-dom/server";

import {
  defineHandlerCallback,
  transformPipeableStreamWithRouter,
  transformReadableStreamWithRouter,
} from "@tanstack/start-server-core";

import type { ReadableStream } from "node:stream/web";
import { rootEcosystem } from "./atoms/ecosystem";
import { createRouter } from "./router";

export const defaultStreamHandler = defineHandlerCallback(
  async ({ request, router, responseHeaders }) => {
    const snapshot = rootEcosystem.dehydrate({
      exclude: ["unserializable"],
      excludeTags: ["unserializable"],
    });
    rootEcosystem.reset();
    const Renderable = () => {
      return (
        <>
          <StartServer router={router} />

          <script
            // biome-ignore lint/security/noDangerouslySetInnerHtml: need to pass the dehydrated snapshot to the client as an executable script
            dangerouslySetInnerHTML={{
              __html: `window.__SNAPSHOT = ${JSON.stringify(snapshot)}`,
            }}
          />
        </>
      );
    };
    if (typeof ReactDOMServer.renderToReadableStream === "function") {
      const stream = await ReactDOMServer.renderToReadableStream(
        <Renderable />,
        {
          signal: request.signal,
        },
      );

      if (isbot(request.headers.get("User-Agent"))) {
        await stream.allReady;
      }

      const responseStream = transformReadableStreamWithRouter(
        router,
        stream as unknown as ReadableStream,
      );
      // biome-ignore lint/suspicious/noExplicitAny: handler code
      return new Response(responseStream as any, {
        status: router.state.statusCode,
        headers: responseHeaders,
      });
    }

    if (typeof ReactDOMServer.renderToPipeableStream === "function") {
      const reactAppPassthrough = new PassThrough();

      try {
        const pipeable = ReactDOMServer.renderToPipeableStream(<Renderable />, {
          ...(isbot(request.headers.get("User-Agent"))
            ? {
                onAllReady() {
                  pipeable.pipe(reactAppPassthrough);
                },
              }
            : {
                onShellReady() {
                  pipeable.pipe(reactAppPassthrough);
                },
              }),
          onError: (error, info) => {
            console.error("Error in renderToPipeableStream:", error, info);
          },
        });
      } catch (e) {
        console.error("Error in renderToPipeableStream:", e);
      }

      const responseStream = transformPipeableStreamWithRouter(
        router,
        reactAppPassthrough,
      );
      // biome-ignore lint/suspicious/noExplicitAny: handler code
      return new Response(responseStream as any, {
        status: router.state.statusCode,
        headers: responseHeaders,
      });
    }

    throw new Error(
      "No renderToReadableStream or renderToPipeableStream found in react-dom/server. Ensure you are using a version of react-dom that supports streaming.",
    );
  },
);
export default createStartHandler({
  createRouter,
  getRouterManifest,
})(defaultStreamHandler);
