/**
 * AWS region configuration for Fracti
 */

export const AWS_REGIONS = [
  {
    value: 'us-east-1',
    label: 'US East (N. Virginia)',
    bedrock: true,
    recommended: true,
  },
  {
    value: 'us-west-2',
    label: 'US West (Oregon)',
    bedrock: true,
  },
  {
    value: 'eu-west-1',
    label: 'Europe (Ireland)',
    bedrock: true,
  },
  {
    value: 'eu-central-1',
    label: 'Europe (Frankfurt)',
    bedrock: true,
  },
  {
    value: 'ap-northeast-1',
    label: 'Asia Pacific (Tokyo)',
    bedrock: true,
  },
  {
    value: 'ap-southeast-1',
    label: 'Asia Pacific (Singapore)',
    bedrock: true,
  },
  {
    value: 'ap-southeast-2',
    label: 'Asia Pacific (Sydney)',
    bedrock: true,
  },
  {
    value: 'ap-south-1',
    label: 'Asia Pacific (Mumbai)',
    bedrock: true,
  },
  {
    value: 'sa-east-1',
    label: 'South America (Sao Paulo)',
    bedrock: false,
  },
];

export const BEDROCK_REGIONS = AWS_REGIONS.filter((r) => r.bedrock);

export function getRegionLabel(regionCode) {
  const region = AWS_REGIONS.find((r) => r.value === regionCode);
  return region ? region.label : regionCode;
}

export function isBedrockAvailable(regionCode) {
  const region = AWS_REGIONS.find((r) => r.value === regionCode);
  return region?.bedrock ?? false;
}

export default {
  AWS_REGIONS,
  BEDROCK_REGIONS,
  getRegionLabel,
  isBedrockAvailable,
};
