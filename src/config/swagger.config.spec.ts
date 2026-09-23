import { usersServiceDetails } from '@/utils/users-service-details';
import { buildSwaggerConfig } from './swagger.config';

describe('buildSwaggerConfig', () => {
  it('identifies the service in the document metadata', () => {
    expect(buildSwaggerConfig().info).toMatchObject({
      title: 'Marketplace Users Service',
      version: usersServiceDetails.version,
      contact: {
        name: 'Marketplace Team',
        url: 'https://marketplace.com',
        email: 'dev@marketplace.com',
      },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    });
  });

  it('writes the description flush left so Swagger renders it as prose', () => {
    const { description } = buildSwaggerConfig().info;

    // An indented line renders as a markdown code block instead of text.
    expect(description).not.toMatch(/^[ \t]+\S/m);
    expect(description).toContain('User accounts');
  });

  it('declares the bearer scheme the future guards will expect', () => {
    expect(
      buildSwaggerConfig().components?.securitySchemes?.['JWT-auth']
    ).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
    });
  });

  it('tags the areas this service owns', () => {
    expect(buildSwaggerConfig().tags?.map((tag) => tag.name)).toEqual([
      'Users',
      'Health',
    ]);
  });

  it('describes every tag, so the sidebar is not a bare list', () => {
    for (const tag of buildSwaggerConfig().tags ?? []) {
      expect(tag.description).toBeTruthy();
    }
  });
});
