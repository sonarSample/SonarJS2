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
// https://sonarsource.github.io/rspec/#/rspec/S6245/javascript

import { Rule } from 'eslint';
import { MemberExpression } from 'estree';
import { SONAR_RUNTIME } from 'linting/eslint/linter/parameters';
import { getFullyQualifiedName, getValueOfExpression, toEncodedMessage } from './helpers';
import { normalizeFQN } from './helpers/aws/cdk';
import { findPropagatedSetting, getProperty, S3BucketTemplate } from './helpers/aws/s3';

const ENCRYPTED_KEY = 'encryption';

const messages = {
  unencrypted: 'Objects in the bucket are not encrypted. Make sure it is safe here.',
  omitted: 'Omitting "encryption" disables server-side encryption. Make sure it is safe here.',
};

export const rule: Rule.RuleModule = S3BucketTemplate(
  (bucket, context) => {
    const encryptedProperty = getProperty(context, bucket, ENCRYPTED_KEY);
    if (encryptedProperty == null) {
      context.report({
        message: toEncodedMessage(messages['omitted'], [], []),
        node: bucket.callee,
      });
      return;
    }

    const encryptedValue = getValueOfExpression(
      context,
      encryptedProperty.value,
      'MemberExpression',
    );
    if (encryptedValue && isUnencrypted(encryptedValue)) {
      const propagated = findPropagatedSetting(encryptedProperty, encryptedValue);
      context.report({
        message: toEncodedMessage(
          messages['unencrypted'],
          propagated.locations,
          propagated.messages,
        ),
        node: encryptedProperty,
      });
    }

    function isUnencrypted(encrypted: MemberExpression) {
      return (
        normalizeFQN(getFullyQualifiedName(context, encrypted)) ===
        'aws_cdk_lib.aws_s3.BucketEncryption.UNENCRYPTED'
      );
    }
  },
  {
    meta: {
      schema: [
        {
          // internal parameter for rules having secondary locations
          enum: [SONAR_RUNTIME],
        },
      ],
    },
  },
);
