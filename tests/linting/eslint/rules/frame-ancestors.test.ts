/*
 * SonarQube JavaScript Plugin
 * Copyright (C) 2011-2023 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import { rule } from 'linting/eslint/rules/frame-ancestors';
import { RuleTester } from 'eslint';

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2018, sourceType: 'module' } });
ruleTester.run(
  'Disabling content security policy frame-ancestors directive is security-sensitive',
  rule,
  {
    valid: [
      {
        code: `
        const csp = require('helmet-csp')
        const express = require('express');
        const app = express();
        app.use(
          csp({}) // frame-ancestors set to 'self' if no directives are supplied
        );`,
      },
      {
        code: `
        const csp = require('helmet-csp')
        const express = require('express');
        const app = express();
        app.use(
          csp({
            directives: {
              "frame-ancestors": ["example.com"]
            }
          })
        );`,
      },
      {
        code: `
        const csp = require('helmet-csp')
        const express = require('express');
        const app = express();
        app.use(
          csp({
            directives: {
              frameAncestors: ["example.com"]
            }
          })
        );`,
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet()
        );`,
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet.contentSecurityPolicy()
        );`,
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet.contentSecurityPolicy({
            directives: {
              "frame-ancestors": ["example.com"]
            }
          })
        );`,
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet.contentSecurityPolicy({
            directives: {
              frameAncestors: ["example.com"]
            }
          })
        );`,
      },
      {
        code: `
        const express = require('express');
        const app = express();
        app.use(
          whatever({
            directives: {
              defaultSrc: ["'self'", 'example.com', 'code.jquery.com'],
            }
          })
        );`,
      },
      {
        code: `
        const express = require('express');
        const app = express();
        app.use(
          unknown.whatever({
            directives: {
              defaultSrc: ["'self'", 'example.com', 'code.jquery.com'],
            }
          })
        );`,
      },
    ],
    invalid: [
      {
        code: `
        const csp = require('helmet-csp')
        const express = require('express');
        const app = express();
        app.use(
          csp({
            directives: {},
          })
        );`,
        errors: [
          {
            message: JSON.stringify({
              message: `Make sure disabling content security policy frame-ancestors directive is safe here.`,
              secondaryLocations: [
                {
                  column: 12,
                  line: 7,
                  endColumn: 26,
                  endLine: 7,
                },
              ],
            }),
            line: 5,
            endLine: 9,
            column: 9,
            endColumn: 10,
          },
        ],
      },
      {
        code: `
        const csp = require('helmet-csp')
        const express = require('express');
        const app = express();
        app.use(
          csp({
            directives: {
              frameAncestors: ["'none'"]
            },
          })
        );`,
        errors: [
          {
            message: JSON.stringify({
              message: `Make sure disabling content security policy frame-ancestors directive is safe here.`,
              secondaryLocations: [
                {
                  column: 14,
                  line: 8,
                  endColumn: 40,
                  endLine: 8,
                },
              ],
            }),
            line: 5,
            endLine: 11,
            column: 9,
            endColumn: 10,
          },
        ],
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet.contentSecurityPolicy({
            directives: {}
          })
        );`,
        errors: 1,
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet.contentSecurityPolicy({
            directives: {
              "frame-ancestors": ["'none'"]
            }
          })
        );`,
        errors: 1,
      },
      {
        code: `
        const helmet = require('helmet');
        const express = require('express');
        const app = express();
        app.use(
          helmet.contentSecurityPolicy({
            directives: {
              frameAncestors: ["'none'"]
            }
          })
        );`,
        errors: 1,
      },
    ],
  },
);
