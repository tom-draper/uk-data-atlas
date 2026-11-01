import type { FastifyReply } from "fastify";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import type { HttpResponse } from "./httpResponse";
import { sendFile } from "./sendFile";

export const sendFastifyResponse = async (
	reply: FastifyReply,
	response: HttpResponse,
) => {
	let body = response.body;
	if (
		body !== undefined &&
		typeof body !== "string" &&
		!Buffer.isBuffer(body)
	) {
		reply.hijack();
		reply.raw.writeHead(response.status, response.headers);
		sendFile(body, reply.raw);
		return reply;
	}
	if (response.gzip && body !== undefined) {
		body = await promisify(gzip)(body, { level: 4 });
		response.headers["content-length"] = String(body.length);
	}
	return reply.code(response.status).headers(response.headers).send(body);
};
