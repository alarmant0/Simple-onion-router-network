import { simpleOnionRouter } from "./simpleOnionRouter";

export async function launchOnionRouters(n: number) {
  const promises = [];

  // launch a n onion routers
  for (let index = 0; index < n; index++) {
    const newPromise = simpleOnionRouter(index);
    promises.push(newPromise);
  }

  const servers = await Promise.all(promises);

  return servers;
}
