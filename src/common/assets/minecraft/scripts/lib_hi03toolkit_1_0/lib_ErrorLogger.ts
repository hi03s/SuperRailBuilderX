import { NGTLog } from "jp.ngt.ngtlib.io";

export type ErrorLogContext = {
	[key: string]: unknown;
};

type JavaClassLike = {
	getName(): string;
};

type JavaObjectLike = {
	getClass?: () => JavaClassLike;
};

type JavaStackTraceLike = {
	length: number;
	[index: number]: unknown;
};

type JavaThrowableLike = JavaObjectLike & {
	getStackTrace?: () => JavaStackTraceLike;
	getCause?: () => JavaThrowableLike | null;
};

type ErrorLike = {
	name?: string;
	message?: string;
	stack?: string;
	javaException?: JavaThrowableLike;
};

/**
 * Java/JavaScriptのどちらから投げられた例外でも安全に詳細を出力するロガー。
 */
export class ErrorLogger {
	static log(
		operation: string,
		phase: string,
		error: unknown,
		context: ErrorLogContext = {},
	): void {
		NGTLog.debug(`###  ${operation} ERROR (detailed)  ###`);
		NGTLog.debug(`phase:${phase}`);
		for (const key in context) {
			if (!Object.prototype.hasOwnProperty.call(context, key)) continue;
			const value = context[key];
			const javaClassName = ErrorLogger.getJavaClassName(value);
			NGTLog.debug(
				`${key}:${ErrorLogger.safeString(value)}${javaClassName ? `, ${key}Class:${javaClassName}` : ""}`,
			);
		}
		ErrorLogger.logException(error);
		NGTLog.debug(`###  ${operation} ERROR END  ###`);
	}

	/** 値の取得自体が失敗する可能性がある場合に使用する。 */
	static capture(provider: () => unknown): unknown {
		try {
			return provider();
		} catch (error) {
			return `<failed to capture: ${ErrorLogger.safeString(error)}>`;
		}
	}

	static safeString(value: unknown): string {
		try {
			return String(value);
		} catch (error) {
			return `<failed to stringify: ${String(error)}>`;
		}
	}

	static getJavaClassName(value: unknown): string | null {
		try {
			const javaObject = value as JavaObjectLike;
			if (!javaObject || typeof javaObject.getClass !== "function") return null;
			const javaClass = javaObject.getClass();
			return javaClass ? String(javaClass.getName()) : null;
		} catch (error) {
			return `<unknown: ${ErrorLogger.safeString(error)}>`;
		}
	}

	private static logException(error: unknown): void {
		if (!error) {
			NGTLog.debug("exception:<none>");
			return;
		}

		NGTLog.debug(`exception:${ErrorLogger.safeString(error)}`);
		try {
			const errorLike = error as ErrorLike;
			if (errorLike.name) NGTLog.debug(`exception.name:${errorLike.name}`);
			if (errorLike.message)
				NGTLog.debug(`exception.message:${errorLike.message}`);
			if (errorLike.stack) NGTLog.debug(`exception.stack:\n${errorLike.stack}`);
		} catch (detailError) {
			NGTLog.debug(
				`exception JS details unavailable:${ErrorLogger.safeString(detailError)}`,
			);
		}

		try {
			const errorLike = error as ErrorLike;
			let cause =
				errorLike.javaException || (error as unknown as JavaThrowableLike);
			for (let depth = 0; cause && depth < 8; depth++) {
				NGTLog.debug(
					`javaCause[${depth}]:${ErrorLogger.getJavaClassName(cause) || "unknown"}: ${ErrorLogger.safeString(cause)}`,
				);
				if (typeof cause.getStackTrace === "function") {
					const stackTrace = cause.getStackTrace();
					for (let i = 0; i < stackTrace.length; i++) {
						NGTLog.debug(`  at ${ErrorLogger.safeString(stackTrace[i])}`);
					}
				}
				cause =
					typeof cause.getCause === "function" ? cause.getCause() : null;
			}
		} catch (detailError) {
			NGTLog.debug(
				`exception Java details unavailable:${ErrorLogger.safeString(detailError)}`,
			);
		}
	}
}
