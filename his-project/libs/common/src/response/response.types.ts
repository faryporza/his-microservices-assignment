export interface ApiResponseStatus {
  code: number;
  message: string;
}

export interface ApiResponseMeta {
  timestamp: string;
  [key: string]: unknown;
}

export interface ApiResponseLinks {
  self: string;
  [key: string]: unknown;
}

export interface ApiResourceObject<T = Record<string, unknown>> {
  type: string;
  id?: string;
  attributes: T;
}

export interface ApiSingleResponse<T = Record<string, unknown>> {
  status: ApiResponseStatus;
  data: ApiResourceObject<T>;
  meta: ApiResponseMeta;
  links: ApiResponseLinks;
}

export interface ApiCollectionResponse<T = Record<string, unknown>> {
  status: ApiResponseStatus;
  data: ApiResourceObject<T>[];
  meta: ApiResponseMeta;
  links: ApiResponseLinks;
}

export interface ApiErrorSource {
  pointer?: string;
  parameter?: string;
  header?: string;
}

export interface ApiErrorObject {
  code: string;
  title: string;
  detail?: string;
  source?: ApiErrorSource;
}

export interface ApiErrorResponse {
  status: ApiResponseStatus;
  errors: ApiErrorObject[];
  meta: ApiResponseMeta;
  links: ApiResponseLinks;
}
