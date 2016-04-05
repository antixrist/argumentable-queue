/**
 * Usage:
 * console.log(xs`
 *   const a is ${a}.
 *   const b is ${b}.
 * `);
 *
 * logged out: 'const a is ${a}.\nconst b is ${b}.'
 */
function xs (strings) {
  const expressions = Array.from(arguments).slice(1);

  if (!expressions.length) {
    return strings[0].replace(/^ +/mg, '').replace(/^\n|\n$/g, '');
  } else {
    return strings.reduce((acc, str, i) => {
      return (
        (i === 1 ? acc.replace(/^ +/mg, '') : acc) +
        expressions[i - 1] +
        str.replace(/^ +/mg, '')
      );
    }).replace(/^\n|\n$/g, '');
  }
}

// spread's variant
//function xs (strings, ...expressions) {
//  if (!expressions.length) {
//    return strings[0].replace(/^ +/mg, '').replace(/^\n|\n$/g, '');
//  } else {
//    return strings.reduce((acc, str, i) => {
//      return (
//        (i === 1 ? acc.replace(/^ +/mg, '') : acc) +
//        expressions[i - 1] +
//        str.replace(/^ +/mg, '')
//      );
//    }).replace(/^\n|\n$/g, '');
//  }
//}

module.exports = xs;
